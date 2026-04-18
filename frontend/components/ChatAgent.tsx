"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import type { StepData } from '@/lib/api';
import { chatVoice, type VoiceChatMessage, type VoiceToolCall } from '@/lib/api';
import { generateAssistantTTS } from '@/lib/tts';

interface ChatAgentProps {
  manualId: string;
  steps: StepData[];
  currentStep: number;
  onVapiStateChange?: (isActive: boolean) => void;
  onGotoStep?: (stepNumber: number) => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function ChatAgent({ steps, currentStep, onVapiStateChange, onGotoStep }: ChatAgentProps) {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const currentStepRef = useRef(currentStep);
  const stepsRef = useRef(steps);
  const historyRef = useRef<VoiceChatMessage[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<string>('');
  const spaceHeldRef = useRef<boolean>(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);
  useEffect(() => { stepsRef.current = steps; }, [steps]);

  // Mark assistant "active" while listening/thinking/speaking so page.tsx silences step narration.
  useEffect(() => {
    onVapiStateChange?.(isActive);
  }, [isActive, onVapiStateChange]);

  useEffect(() => {
    setIsActive(isListening || isThinking || isSpeaking);
  }, [isListening, isThinking, isSpeaking]);

  const buildStepsContext = useCallback(() => {
    return stepsRef.current
      .map((s, i) => `Step ${s.step_number || i + 1}: ${s.title}\n${s.description}`)
      .join('\n\n');
  }, []);

  const stopAssistantAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (chatAbortRef.current) {
      chatAbortRef.current.abort();
      chatAbortRef.current = null;
    }
    setIsSpeaking(false);
    setIsThinking(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setUnsupported(true);
      return;
    }

    // Interrupt anything currently happening.
    stopAssistantAudio();

    try {
      recognitionRef.current?.abort();
    } catch {}

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    transcriptRef.current = '';

    recognition.onresult = (event) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        }
      }
      if (finalText) {
        transcriptRef.current = (transcriptRef.current + ' ' + finalText).trim();
      }
    };

    recognition.onerror = (event) => {
      console.warn('SpeechRecognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      const finalTranscript = transcriptRef.current.trim();
      if (finalTranscript) {
        void runTurn(finalTranscript);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.warn('Failed to start SpeechRecognition:', err);
      setIsListening(false);
    }
  }, [stopAssistantAudio]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {}
  }, []);

  const runTurn = useCallback(async (userText: string) => {
    historyRef.current = [...historyRef.current, { role: 'user', content: userText }];

    const chatAbort = new AbortController();
    chatAbortRef.current = chatAbort;
    setIsThinking(true);

    let reply: { text: string; toolCalls: VoiceToolCall[] } = { text: '', toolCalls: [] };
    try {
      reply = await chatVoice(
        historyRef.current,
        buildStepsContext(),
        currentStepRef.current,
        stepsRef.current.length,
        chatAbort.signal,
      );
    } catch (err) {
      if (chatAbort.signal.aborted) return;
      console.error('voice chat failed', err);
      setIsThinking(false);
      return;
    } finally {
      if (chatAbortRef.current === chatAbort) chatAbortRef.current = null;
    }

    if (chatAbort.signal.aborted) return;

    for (const call of reply.toolCalls) {
      if (call.name === 'goto_step') {
        const n = Number((call.args as { step_number?: unknown }).step_number);
        if (Number.isFinite(n) && onGotoStep) {
          onGotoStep(Math.round(n));
        }
      }
    }

    const replyText = reply.text.trim();
    if (!replyText) {
      setIsThinking(false);
      return;
    }

    historyRef.current = [...historyRef.current, { role: 'assistant', content: replyText }];

    const ttsAbort = new AbortController();
    ttsAbortRef.current = ttsAbort;
    let audioUrl = '';
    try {
      audioUrl = await generateAssistantTTS(replyText, ttsAbort.signal);
    } catch (err) {
      if (ttsAbort.signal.aborted) return;
      console.error('TTS failed', err);
      setIsThinking(false);
      return;
    } finally {
      if (ttsAbortRef.current === ttsAbort) ttsAbortRef.current = null;
    }

    if (ttsAbort.signal.aborted) {
      URL.revokeObjectURL(audioUrl);
      return;
    }

    setIsThinking(false);

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onplay = () => setIsSpeaking(true);
    const done = () => {
      setIsSpeaking(false);
      URL.revokeObjectURL(audioUrl);
      if (audioRef.current === audio) audioRef.current = null;
    };
    audio.onended = done;
    audio.onerror = done;

    try {
      await audio.play();
    } catch (err) {
      console.warn('audio.play failed', err);
      done();
    }
  }, [buildStepsContext]);

  // Space bar = push-to-talk.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (spaceHeldRef.current) return;
      spaceHeldRef.current = true;
      e.preventDefault();
      startListening();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (!spaceHeldRef.current) return;
      spaceHeldRef.current = false;
      e.preventDefault();
      stopListening();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [startListening, stopListening]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopAssistantAudio();
      try { recognitionRef.current?.abort(); } catch {}
    };
  }, [stopAssistantAudio]);

  const handleMouseDown = () => {
    if (spaceHeldRef.current) return;
    spaceHeldRef.current = true;
    startListening();
  };
  const handleMouseUp = () => {
    if (!spaceHeldRef.current) return;
    spaceHeldRef.current = false;
    stopListening();
  };

  const buttonState = isListening
    ? 'listening'
    : isThinking
    ? 'thinking'
    : isSpeaking
    ? 'speaking'
    : 'idle';

  const isAccent = buttonState === 'listening' || buttonState === 'speaking' || buttonState === 'thinking';
  return (
    <button
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={(e) => { e.preventDefault(); handleMouseDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); handleMouseUp(); }}
      disabled={unsupported}
      style={{
        width: 40,
        height: 40,
        display: 'grid',
        placeItems: 'center',
        borderRadius: 12,
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        borderStyle: 'solid',
        borderColor: isAccent ? 'var(--pop)' : 'var(--rule)',
        background: isAccent ? 'var(--pop)' : 'var(--paper)',
        color: isAccent ? 'var(--paper)' : 'var(--ink)',
        cursor: unsupported ? 'not-allowed' : 'pointer',
        transition: 'all .15s',
        animation: buttonState === 'speaking' || buttonState === 'thinking' ? 'pulse-dot 1.4s ease-in-out infinite' : undefined,
      }}
      title={
        unsupported
          ? 'Speech recognition is not supported in this browser'
          : buttonState === 'listening'
          ? 'Listening — release Space to send'
          : buttonState === 'thinking'
          ? 'Thinking…'
          : buttonState === 'speaking'
          ? 'Speaking — press Space to interrupt'
          : 'Hold Space (or this button) to talk'
      }
    >
      {isActive ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
