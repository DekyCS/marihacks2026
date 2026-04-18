"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import Vapi from '@vapi-ai/web';
import type { StepData } from '@/lib/api';

interface ChatAgentProps {
  manualId: string;
  steps: StepData[];
  currentStep: number;
  onVapiStateChange?: (isActive: boolean) => void;
}

// Initialize Vapi client outside component to avoid re-initialization
let vapiInstance: Vapi | null = null;

const getVapi = () => {
  if (!vapiInstance) {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) {
      return null;
    }
    vapiInstance = new Vapi(publicKey);
  }
  return vapiInstance;
};

export default function ChatAgent({ manualId, steps, currentStep, onVapiStateChange }: ChatAgentProps) {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const currentStepRef = useRef(currentStep);

  // Keep currentStep ref updated
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Notify parent when Vapi state changes
  useEffect(() => {
    onVapiStateChange?.(isActive);
  }, [isActive, onVapiStateChange]);

  useEffect(() => {
    const vapi = getVapi();
    if (!vapi) return;

    // Set up event listeners
    const handleCallStart = () => {
      setIsConnecting(false);
      setIsActive(true);
    };

    const handleCallEnd = () => {
      setIsActive(false);
      setIsConnecting(false);
      setIsSpeaking(false);
    };

    const handleSpeechStart = () => {
      setIsSpeaking(true);
    };

    const handleSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const handleError = () => {
      setIsActive(false);
      setIsConnecting(false);
    };

    const handleMessage = () => {};

    vapi.on('call-start', handleCallStart);
    vapi.on('call-end', handleCallEnd);
    vapi.on('speech-start', handleSpeechStart);
    vapi.on('speech-end', handleSpeechEnd);
    vapi.on('error', handleError);
    vapi.on('message', handleMessage);

    return () => {
      vapi.off('call-start', handleCallStart);
      vapi.off('call-end', handleCallEnd);
      vapi.off('speech-start', handleSpeechStart);
      vapi.off('speech-end', handleSpeechEnd);
      vapi.off('error', handleError);
      vapi.off('message', handleMessage);
    };
  }, []);

  const buildSystemPrompt = () => {
    const stepsContext = steps.map((step, i) =>
      `Step ${step.step_number || i + 1}: ${step.title}\n${step.description}`
    ).join('\n\n');

    return `You are an assembly assistant. Help the user build their product.

Steps:
${stepsContext}

Current step: ${currentStepRef.current + 1}

Rules:
- NEVER read out the step description word for word - explain it in your own words
- Keep responses brief (1-2 sentences)
- Answer questions directly
- Stay focused on the assembly task`;
  };

  const toggleCall = async () => {
    const vapi = getVapi();
    if (!vapi) {
      alert('Vapi not configured. Please set NEXT_PUBLIC_VAPI_PUBLIC_KEY');
      return;
    }

    if (isActive) {
      // End the call
      vapi.stop();
      setIsActive(false);
    } else {
      // Start a new call
      setIsConnecting(true);

      try {
        // Check if we should use an assistant ID from env
        const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

        if (assistantId) {
          // Use pre-configured assistant with variable overrides
          await vapi.start(assistantId, {
            variableValues: {
              currentStep: String(currentStepRef.current + 1),
              stepsContext: buildSystemPrompt()
            }
          });
        } else {
          // Start call with inline assistant configuration
          await vapi.start({
            model: {
              provider: "openai",
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: buildSystemPrompt()
                }
              ]
            },
            voice: {
              provider: "11labs",
              voiceId: "21m00Tcm4TlvDq8ikWAM"
            }
          });
        }
      } catch (error: any) {
        setIsConnecting(false);
        const errorMsg = error?.message || error?.error?.message || 'Unknown error';
        alert(`Failed to start voice assistant: ${errorMsg}\n\nMake sure NEXT_PUBLIC_VAPI_PUBLIC_KEY is set correctly.`);
      }
    }
  };

  const getButtonState = () => {
    if (isConnecting) return 'connecting';
    if (isSpeaking) return 'speaking';
    if (isActive) return 'active';
    return 'inactive';
  };

  const buttonState = getButtonState();

  const isAccent = buttonState === 'active' || buttonState === 'speaking' || buttonState === 'connecting';
  return (
    <button
      onClick={toggleCall}
      disabled={isConnecting}
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
        cursor: isConnecting ? 'not-allowed' : 'pointer',
        transition: 'all .15s',
        animation: buttonState === 'speaking' || buttonState === 'connecting' ? 'pulse-dot 1.4s ease-in-out infinite' : undefined,
      }}
      title={
        buttonState === 'connecting'
          ? 'Connecting...'
          : buttonState === 'speaking'
          ? 'Assistant is speaking...'
          : buttonState === 'active'
          ? 'Click to end conversation'
          : 'Click to talk to AI Assistant'
      }
    >
      {isActive ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
