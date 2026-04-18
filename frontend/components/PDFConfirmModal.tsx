"use client";
import React from 'react';
import { X, Check, RotateCcw, ExternalLink, Loader2 } from 'lucide-react';
import { getPDFUrl } from '@/lib/api';

interface PDFConfirmModalProps {
  isDark: boolean;
  pdfHash: string;
  filename: string;
  productName: string;
  sourceUrl: string;
  isProcessing: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

export default function PDFConfirmModal({
  isDark,
  pdfHash,
  filename,
  productName,
  sourceUrl,
  isProcessing,
  onConfirm,
  onReject,
}: PDFConfirmModalProps) {
  const pdfUrl = getPDFUrl(filename, pdfHash);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className={`relative w-full max-w-4xl h-[85vh] rounded-3xl flex flex-col ${
          isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
        }`}
      >
        <button
          onClick={onReject}
          disabled={isProcessing}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors disabled:opacity-40 ${
            isDark ? 'hover:bg-white/10 text-zinc-400' : 'hover:bg-black/5 text-zinc-600'
          }`}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-3 pr-14">
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            Is this the right manual?
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            <span className="font-medium">{productName}</span>
            {sourceUrl && sourceUrl !== 'demo://local' && (
              <>
                {' · '}
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-purple-500 hover:underline"
                >
                  source <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </p>
        </div>

        <div className="flex-1 px-6 min-h-0">
          <iframe
            src={pdfUrl}
            title="Manual preview"
            className={`w-full h-full rounded-xl border ${
              isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'
            }`}
          />
        </div>

        <div className="p-6 pt-4 flex items-center justify-between gap-3">
          <button
            onClick={onReject}
            disabled={isProcessing}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark
                ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
            }`}
          >
            <RotateCcw className="w-4 h-4" /> Wrong manual, rescan
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> Looks right — generate 3D guide
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
