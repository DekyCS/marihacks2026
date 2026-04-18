"use client";
import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';
import { X, Camera, Keyboard, Loader2 } from 'lucide-react';

const BARCODE_HINTS = new Map<DecodeHintType, unknown>([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.QR_CODE,
    ],
  ],
  [DecodeHintType.TRY_HARDER, true],
]);

interface BarcodeScannerProps {
  isDark: boolean;
  onScanned: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ isDark, onScanned, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onScannedRef = useRef(onScanned);
  const scannedRef = useRef(false);
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    onScannedRef.current = onScanned;
  }, [onScanned]);

  useEffect(() => {
    if (mode !== 'camera') return;

    let cancelled = false;
    let activeStream: MediaStream | null = null;
    const reader = new BrowserMultiFormatReader(BARCODE_HINTS, {
      delayBetweenScanAttempts: 80,
      delayBetweenScanSuccess: 80,
    });
    setIsStarting(true);
    setCameraError(null);
    scannedRef.current = false;

    const stopAll = () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
        activeStream = null;
      }
      const video = videoRef.current;
      if (video) {
        try { video.pause(); } catch {}
        video.srcObject = null;
      }
    };

    const requestStream = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (err) {
        const name = (err as { name?: string })?.name ?? '';
        if (name === 'OverconstrainedError' || name === 'NotFoundError') {
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        throw err;
      }
    };

    (async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser does not support camera access.');
        setIsStarting(false);
        return;
      }

      try {
        const stream = await requestStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        activeStream = stream;

        const video = videoRef.current;
        if (!video) {
          stopAll();
          return;
        }
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) resolve();
          else video.onloadedmetadata = () => resolve();
        });
        await video.play().catch(() => {
          throw new Error('Could not start video playback.');
        });
        if (cancelled) { stopAll(); return; }

        const controls = await reader.decodeFromVideoElement(video, (result, _err, ctrl) => {
          if (result && !cancelled && !scannedRef.current) {
            scannedRef.current = true;
            ctrl.stop();
            stopAll();
            onScannedRef.current(result.getText());
          }
        });
        if (cancelled) {
          controls.stop();
          stopAll();
          return;
        }
        controlsRef.current = controls;
        setIsStarting(false);
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? '';
        const msg = err instanceof Error ? err.message : 'Unable to start camera.';
        const lower = msg.toLowerCase();
        let friendly = msg;
        if (name === 'NotAllowedError' || lower.includes('permission') || lower.includes('denied')) {
          friendly = 'Camera permission denied. Allow access in your browser or use manual input.';
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          friendly = 'No camera available. Use manual input instead.';
        } else if (name === 'NotReadableError') {
          friendly = 'Camera is in use by another app. Close it and try again.';
        } else if (window.isSecureContext === false) {
          friendly = 'Camera requires HTTPS or localhost.';
        }
        setCameraError(friendly);
        stopAll();
        setIsStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [mode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) onScanned(code);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-lg rounded-3xl p-6 ${
          isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
        }`}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
            isDark ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-black/5 text-zinc-600'
          }`}
          aria-label="Close scanner"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className={`text-xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
          Scan a barcode
        </h2>
        <p className={`text-sm mb-5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          Point your camera at a product barcode. We&apos;ll find the manual automatically.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('camera')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              mode === 'camera'
                ? 'bg-purple-500 text-white'
                : isDark
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <Camera className="w-4 h-4" /> Camera
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
              mode === 'manual'
                ? 'bg-purple-500 text-white'
                : isDark
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            <Keyboard className="w-4 h-4" /> Enter code
          </button>
        </div>

        {mode === 'camera' ? (
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {isStarting && !cameraError && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm">Starting camera…</span>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                <span className="text-sm text-red-400">{cameraError}</span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-[20%] border-2 border-purple-400/70 rounded-xl" />
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="e.g. 7391846005810"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                isDark
                  ? 'bg-zinc-800 text-white border border-zinc-700'
                  : 'bg-zinc-50 text-zinc-900 border border-zinc-200'
              }`}
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Find manual
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
