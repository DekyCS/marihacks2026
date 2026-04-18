"use client";
import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, CheckCircle2, Globe, AlertCircle } from 'lucide-react';
import { openScanStream, ScanStreamEvent, BarcodeScanResult } from '@/lib/api';

interface ScanProgressProps {
  isDark: boolean;
  barcode: string;
  onReady: (result: BarcodeScanResult) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

interface Step {
  id: number;
  label: string;
  done: boolean;
}

export default function ScanProgress({
  isDark,
  barcode,
  onReady,
  onError,
  onClose,
}: ScanProgressProps) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'running' | 'downloading' | 'done' | 'error'>('running');
  const [headerText, setHeaderText] = useState(`Searching for barcode ${barcode}…`);
  const stepIdRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onReady, onError]);

  useEffect(() => {
    if (esRef.current) return;
    const es = openScanStream(barcode);
    esRef.current = es;

    const pushStep = (label: string) => {
      const id = ++stepIdRef.current;
      setSteps((prev) => {
        const updated = prev.map((s) => ({ ...s, done: true }));
        return [...updated, { id, label, done: false }];
      });
    };

    es.onmessage = (ev) => {
      let event: ScanStreamEvent;
      try {
        event = JSON.parse(ev.data);
      } catch {
        return;
      }

      switch (event.type) {
        case 'STARTED':
          pushStep('Starting web agent');
          break;
        case 'STREAMING_URL':
          setStreamingUrl(event.streaming_url);
          break;
        case 'PROGRESS':
          if (event.purpose) pushStep(event.purpose);
          break;
        case 'TF_API_RESULT':
        case 'HEARTBEAT':
          break;
        case 'COMPLETE':
          setSteps((prev) => prev.map((s) => ({ ...s, done: true })));
          break;
        case 'DOWNLOADING':
          setStatus('downloading');
          setHeaderText('Downloading manual PDF…');
          pushStep('Downloading PDF');
          break;
        case 'READY':
          setSteps((prev) => prev.map((s) => ({ ...s, done: true })));
          setStatus('done');
          es.close();
          esRef.current = null;
          onReadyRef.current({
            pdf_hash: event.pdf_hash,
            filename: event.filename,
            product_name: event.product_name,
            source_url: event.source_url,
          });
          break;
        case 'ERROR':
          setStatus('error');
          setHeaderText('Agent failed');
          es.close();
          esRef.current = null;
          onErrorRef.current(event.message);
          break;
      }
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      setStatus('error');
      es.close();
      esRef.current = null;
      onErrorRef.current('Connection lost while streaming agent events.');
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [barcode]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className={`relative w-full max-w-5xl h-[80vh] rounded-3xl flex flex-col overflow-hidden ${
          isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
        }`}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 p-2 rounded-full transition-colors ${
            isDark ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-black/5 text-zinc-600'
          }`}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-3 pr-14">
          <h2 className={`text-xl font-semibold flex items-center gap-2 ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            {status === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : status === 'done' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            )}
            {headerText}
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Watching the TinyFish agent browse the web in real time.
          </p>
        </div>

        <div className="flex-1 flex min-h-0 gap-4 px-6 pb-6">
          <aside className={`w-72 rounded-2xl p-4 overflow-y-auto ${
            isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-zinc-50 border border-zinc-200'
          }`}>
            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
              isDark ? 'text-zinc-500' : 'text-zinc-500'
            }`}>
              Agent steps
            </h3>
            {steps.length === 0 ? (
              <div className={`text-xs ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                Waiting for first event…
              </div>
            ) : (
              <ol className="space-y-2">
                {steps.map((step) => (
                  <li key={step.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex-shrink-0">
                      {step.done ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                      )}
                    </span>
                    <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                      {step.label}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </aside>

          <div className={`flex-1 rounded-2xl overflow-hidden border ${
            isDark ? 'border-zinc-800 bg-black' : 'border-zinc-200 bg-zinc-100'
          }`}>
            {streamingUrl ? (
              <iframe
                src={streamingUrl}
                title="Live agent browser"
                className="w-full h-full"
                allow="fullscreen"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <Globe className={`w-10 h-10 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`} />
                <span className={`text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Waiting for live browser view…
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
