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

  return (
    <button
      onClick={toggleCall}
      disabled={isConnecting}
      className={`glass-navbar light-glass-navbar p-2 rounded-full transition-all ${
        buttonState === 'connecting'
          ? 'bg-yellow-600/20 text-yellow-400 animate-pulse'
          : buttonState === 'speaking'
          ? 'bg-green-600/20 text-green-400 animate-pulse'
          : buttonState === 'active'
          ? 'bg-red-600/20 text-red-400 hover:text-red-300'
          : 'text-zinc-300 hover:text-white hover:bg-indigo-600/20'
      }`}
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
      {isActive ? (
        <MicOff className="w-5 h-5" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  );
}
