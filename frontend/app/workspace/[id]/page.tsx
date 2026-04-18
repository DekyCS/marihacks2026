"use client";

import React, { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import AssemblyScene from '@/components/AssemblyScene';
import ChatAgent from '@/components/ChatAgent';
import {
  fetchManualJSON,
  getComponentModelUrl,
  getPDFUrl,
  type ManualJSON,
} from '@/lib/api';
import { generateTTS } from '@/lib/tts';

const Document = dynamic(() => import('react-pdf').then((mod) => mod.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then((mod) => mod.Page), { ssr: false });

if (typeof window !== 'undefined') {
  import('react-pdf').then(({ pdfjs }) => {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  });
}

interface WorkspaceProps {
  params: Promise<{ id: string }>;
}

export default function Workspace({ params }: WorkspaceProps) {
  const { id } = use(params);

  const [manualData, setManualData] = useState<ManualJSON | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [isVapiActive, setIsVapiActive] = useState<boolean>(false);
  const [initialDelayComplete, setInitialDelayComplete] = useState<boolean>(false);

  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfWidth, setPdfWidth] = useState<number>(480);
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(1);
  const [pdfVisible, setPdfVisible] = useState<boolean>(true);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentStepRef = useRef<number>(currentStep);
  const ttsAbortControllerRef = useRef<AbortController | null>(null);
  const prevVapiActiveRef = useRef<boolean>(false);
  const lastStepPlayedRef = useRef<number>(0);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchManualJSON(id);
        setManualData(data);
      } catch (err) {
        console.error('Failed to load manual', err);
        setError('Failed to load instruction manual. Make sure the backend server is running.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const activeStepData = manualData ? manualData.steps[currentStep - 1] : null;
  const totalSteps = manualData ? manualData.steps.length : 0;

  useEffect(() => {
    if (!manualData || loading) return;
    const timer = setTimeout(() => setInitialDelayComplete(true), 2000);
    return () => clearTimeout(timer);
  }, [manualData, loading]);

  useEffect(() => {
    if (!activeStepData || !activeStepData.description) return;
    if (!initialDelayComplete) return;

    if (isVapiActive) {
      prevVapiActiveRef.current = true;
      return;
    }

    if (prevVapiActiveRef.current && lastStepPlayedRef.current === currentStep) {
      prevVapiActiveRef.current = false;
      return;
    }
    prevVapiActiveRef.current = false;

    const stepForThisAudio = currentStep;
    lastStepPlayedRef.current = currentStep;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort();
      ttsAbortControllerRef.current = null;
    }

    setIsPlaying(false);
    const abortController = new AbortController();
    ttsAbortControllerRef.current = abortController;

    generateTTS(activeStepData.description, currentStep, abortController.signal)
      .then((audioUrl) => {
        if (abortController.signal.aborted) {
          URL.revokeObjectURL(audioUrl);
          return;
        }
        if (currentStepRef.current !== stepForThisAudio) {
          URL.revokeObjectURL(audioUrl);
          return;
        }
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.muted = isMuted;
        audio.currentTime = 0;
        audio.onplay = () => {
          if (currentStepRef.current === stepForThisAudio) setIsPlaying(true);
        };
        audio.onended = () => {
          if (currentStepRef.current === stepForThisAudio) setIsPlaying(false);
        };
        audio.onerror = () => {
          if (currentStepRef.current === stepForThisAudio) setIsPlaying(false);
        };
        if (currentStepRef.current === stepForThisAudio) {
          audio.play().catch(() => {
            if (currentStepRef.current === stepForThisAudio) setIsPlaying(false);
          });
        } else {
          URL.revokeObjectURL(audioUrl);
        }
      })
      .catch(() => {
        if (!abortController.signal.aborted && currentStepRef.current === stepForThisAudio) {
          setIsPlaying(false);
        }
      });

    return () => {
      if (ttsAbortControllerRef.current) {
        ttsAbortControllerRef.current.abort();
        ttsAbortControllerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [currentStep, activeStepData, isMuted, isVapiActive, initialDelayComplete]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const updatePdfWidth = () => {
      if (pdfContainerRef.current) {
        const containerWidth = pdfContainerRef.current.offsetWidth;
        setPdfWidth(Math.min(containerWidth - 32, 800));
      }
    };
    updatePdfWidth();
    window.addEventListener('resize', updatePdfWidth);
    return () => window.removeEventListener('resize', updatePdfWidth);
  }, [pdfVisible]);

  useEffect(() => {
    if (!pdfContainerRef.current || !numPages) return;
    const options = {
      root: pdfContainerRef.current,
      rootMargin: '-10% 0px -90% 0px',
      threshold: 0,
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const pageIndex = parseInt(entry.target.getAttribute('data-page-index') || '0');
          setCurrentPdfPage(pageIndex + 1);
        }
      });
    }, options);
    pageRefs.current.forEach((pageEl, index) => {
      if (pageEl) {
        pageEl.setAttribute('data-page-index', index.toString());
        observer.observe(pageEl);
      }
    });
    return () => observer.disconnect();
  }, [numPages]);

  useEffect(() => {
    if (!initialDelayComplete) return;
    if (!activeStepData?.page_number || !pdfContainerRef.current || !numPages) return;
    const page_number = activeStepData.page_number;
    const pageElement = pageRefs.current[page_number];
    if (!pageElement || page_number < 0 || page_number >= numPages) return;
    const performScroll = () => {
      if (!pdfContainerRef.current || !pageElement) return;
      const pageTop = pageElement.offsetTop;
      const renderedPageHeight = pageElement.offsetHeight;
      let yPosition = 0;
      if (activeStepData.bounding_box?.y !== undefined) {
        yPosition = (activeStepData.bounding_box.y / 100) * renderedPageHeight;
      }
      const containerHeight = pdfContainerRef.current.offsetHeight;
      const offset = containerHeight * 0.2;
      const targetScrollTop = Math.max(0, pageTop + yPosition - offset);
      pdfContainerRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    };
    if (pageElement.offsetHeight === 0) {
      const timer = setTimeout(() => {
        if (pageElement.offsetHeight > 0) performScroll();
      }, 100);
      return () => clearTimeout(timer);
    }
    performScroll();
  }, [currentStep, activeStepData, numPages, initialDelayComplete]);

  const getComponentsForScene = () => {
    if (!manualData || !activeStepData) return [];
    const componentCounts: Record<string, number> = {};
    return activeStepData.components
      .map((compId) => {
        const component = manualData.components.find((c) => c.id === compId);
        if (!component || !component.model_path) return null;
        if (!componentCounts[compId]) componentCounts[compId] = 0;
        const occurrenceIndex = componentCounts[compId];
        componentCounts[compId]++;
        const indexedKey = `${compId}_${occurrenceIndex}`;
        let positionData = activeStepData.component_positions[indexedKey];
        if (!positionData) positionData = activeStepData.component_positions[compId];
        if (!positionData) return null;
        const isMoving = !!positionData.movement;
        return {
          modelUrl: getComponentModelUrl(component, manualData.manual_id),
          isMoving,
          position: { x: positionData.x, y: positionData.y, z: positionData.z },
          rotation: positionData.rotation || { x: 0, y: 0, z: 0 },
          scale: positionData.scale || { x: 1, y: 1, z: 1 },
          movement: positionData.movement,
        };
      })
      .filter(Boolean) as Array<{
      modelUrl: string;
      isMoving: boolean;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
      movement?: { position: { x: number; y: number; z: number } };
    }>;
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--paper)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              width: 32,
              height: 32,
              border: '2px solid var(--pop)',
              borderTopColor: 'transparent',
              borderRadius: 999,
              animation: 'spin-slow 1s linear infinite',
              marginBottom: 14,
            }}
          />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>
            Loading 3D Manual…
          </div>
          <div
            className="mono"
            style={{ color: 'var(--ink-mute)', marginTop: 8 }}
          >
            FETCHING ASSETS
          </div>
        </div>
      </div>
    );
  }

  if (error || !manualData || !activeStepData) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--paper)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, marginBottom: 10 }}>
            <span className="display-italic" style={{ color: 'var(--pop)' }}>
              Oops.
            </span>
          </h2>
          <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>
            {error || 'Manual not found'}
          </p>
          <Link href="/upload" className="btn btn-primary" style={{ border: 'none' }}>
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--paper)',
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
      }}
    >
      <header
        style={{
          height: 56,
          borderBottom: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'var(--paper)',
          position: 'relative',
          zIndex: 30,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <Link
            href="/upload"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--ink-mute)',
              textDecoration: 'none',
            }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <rect x={3} y={3} width={18} height={18} rx={3} stroke="currentColor" strokeWidth={1.6} />
              <path d="M3 9 L21 9" stroke="currentColor" strokeWidth={1.6} />
            </svg>
          </Link>
          <span style={{ color: 'var(--ink-mute)' }}>/</span>
          <Link
            href="/upload"
            style={{ color: 'var(--ink-mute)', textDecoration: 'none', fontSize: 13 }}
          >
            Projects
          </Link>
          <span style={{ color: 'var(--ink-mute)' }}>/</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {manualData.pdf_filename.replace('.pdf', '')}
          </span>
          <span className="chip" style={{ marginLeft: 10 }}>
            <span className="dot" />
            READY · {totalSteps} STEPS
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="mono" style={{ color: 'var(--ink-mute)' }}>
            STEP {currentStep} / {totalSteps}
          </span>
          <button
            onClick={() => setPdfVisible((v) => !v)}
            className="btn btn-ghost"
            style={{ padding: '8px 14px', fontSize: 13 }}
          >
            {pdfVisible ? 'Hide PDF' : 'Show PDF'}
          </button>
        </div>
      </header>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: pdfVisible ? '3fr 2fr' : '1fr 360px',
          gridTemplateRows: '1fr',
          minHeight: 0,
        }}
      >
        {/* LEFT: 3D viewer */}
        <section
          style={{
            position: 'relative',
            background: 'var(--paper-2)',
            overflow: 'hidden',
            borderRight: '1px solid var(--rule)',
          }}
        >
          <div className="ws-grid-bg-lg" />
          <div className="ws-grid-bg" />

          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            <AssemblyScene
              components={getComponentsForScene()}
              resetTrigger={resetTrigger}
              zoomLevel={activeStepData?.zoom || 1}
            />
          </div>

          {/* Step panel */}
          {activeStepData && (
            <div
              style={{
                position: 'absolute',
                top: 20,
                left: 20,
                maxWidth: 400,
                background: 'var(--paper)',
                border: '1px solid var(--rule-strong)',
                borderRadius: 14,
                padding: '18px 20px',
                boxShadow: '0 10px 40px rgba(0,0,0,.08)',
                zIndex: 5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span className="mono" style={{ color: 'var(--pop)' }}>
                  STEP {String(currentStep).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
                </span>
                {isPlaying && (
                  <span className="chip">
                    <span className="dot" />
                    SPEAKING
                  </span>
                )}
              </div>
              <h2
                style={{
                  fontSize: 22,
                  marginBottom: 8,
                  lineHeight: 1.15,
                  letterSpacing: '-0.015em',
                }}
              >
                {activeStepData.description.split('.')[0] || 'Step'}
              </h2>
              <p
                style={{
                  color: 'var(--ink-soft)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {activeStepData.description}
              </p>
            </div>
          )}

          {/* Tools top-right */}
          <div
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              display: 'flex',
              gap: 8,
              zIndex: 5,
            }}
          >
            <ChatAgent
              manualId={manualData.manual_id}
              steps={manualData.steps}
              currentStep={currentStep}
              onVapiStateChange={(active) => {
                setIsVapiActive(active);
                if (active && audioRef.current) {
                  audioRef.current.pause();
                  setIsPlaying(false);
                }
              }}
            />
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.play().catch(() => {});
                }
              }}
              style={{
                width: 40,
                height: 40,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 12,
                border: '1px solid var(--rule)',
                background: 'var(--paper)',
                color: 'var(--ink)',
                cursor: 'pointer',
                transition: 'all .15s',
              }}
              title="Replay audio"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
            </button>
            <button
              onClick={() => setIsMuted((m) => !m)}
              style={{
                width: 40,
                height: 40,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 12,
                border: '1px solid var(--rule)',
                background: isMuted ? 'var(--pop)' : 'var(--paper)',
                color: isMuted ? 'var(--paper)' : 'var(--ink)',
                cursor: 'pointer',
              }}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M11 5L6 9H2v6h4l5 4z" />
                  <path d="M23 9l-6 6M17 9l6 6" />
                </svg>
              ) : (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M11 5L6 9H2v6h4l5 4z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>
          </div>

          {/* Timeline above nav */}
          <div
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: 96,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              zIndex: 4,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--ink-mute)',
                letterSpacing: '.06em',
                position: 'absolute',
                top: -14,
                left: 0,
              }}
            >
              STEPS
            </span>
            {Array.from({ length: totalSteps }).map((_, i) => {
              const idx = i + 1;
              const done = idx < currentStep;
              const now = idx === currentStep;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    background: done ? 'var(--ink)' : 'var(--rule)',
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {now && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '45%',
                        background: 'var(--pop)',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Side arrow buttons for step navigation */}
          <button
            onClick={() => {
              if (currentStep > 1) {
                setCurrentStep(currentStep - 1);
                setResetTrigger((v) => v + 1);
              }
            }}
            disabled={currentStep === 1}
            aria-label="Previous step"
            style={{
              position: 'absolute',
              left: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 56,
              height: 56,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 999,
              background: 'var(--paper)',
              borderTopWidth: 1,
              borderRightWidth: 1,
              borderBottomWidth: 1,
              borderLeftWidth: 1,
              borderStyle: 'solid',
              borderColor: 'var(--rule-strong)',
              color: 'var(--ink)',
              cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 1 ? 0.3 : 1,
              boxShadow: '0 10px 30px rgba(0,0,0,.12)',
              zIndex: 6,
              transition: 'transform .15s ease, background .15s ease',
            }}
            onMouseEnter={(e) => {
              if (currentStep !== 1) {
                e.currentTarget.style.background = 'var(--ink)';
                e.currentTarget.style.color = 'var(--paper)';
                e.currentTarget.style.transform = 'translateY(-50%) translateX(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--paper)';
              e.currentTarget.style.color = 'var(--ink)';
              e.currentTarget.style.transform = 'translateY(-50%)';
            }}
          >
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (currentStep < totalSteps) {
                setCurrentStep(currentStep + 1);
                setResetTrigger((v) => v + 1);
              }
            }}
            disabled={currentStep === totalSteps}
            aria-label="Next step"
            style={{
              position: 'absolute',
              right: 20,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 56,
              height: 56,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 999,
              background: 'var(--paper)',
              borderTopWidth: 1,
              borderRightWidth: 1,
              borderBottomWidth: 1,
              borderLeftWidth: 1,
              borderStyle: 'solid',
              borderColor: 'var(--rule-strong)',
              color: 'var(--ink)',
              cursor: currentStep === totalSteps ? 'not-allowed' : 'pointer',
              opacity: currentStep === totalSteps ? 0.3 : 1,
              boxShadow: '0 10px 30px rgba(0,0,0,.12)',
              zIndex: 6,
              transition: 'transform .15s ease, background .15s ease',
            }}
            onMouseEnter={(e) => {
              if (currentStep !== totalSteps) {
                e.currentTarget.style.background = 'var(--ink)';
                e.currentTarget.style.color = 'var(--paper)';
                e.currentTarget.style.transform = 'translateY(-50%) translateX(2px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--paper)';
              e.currentTarget.style.color = 'var(--ink)';
              e.currentTarget.style.transform = 'translateY(-50%)';
            }}
          >
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          {/* Axis gizmo */}
          <svg
            style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              width: 70,
              height: 70,
              zIndex: 4,
              pointerEvents: 'none',
            }}
            viewBox="0 0 70 70"
          >
            <line x1={35} y1={35} x2={60} y2={35} stroke="var(--ink)" strokeWidth={1.5} />
            <line x1={35} y1={35} x2={35} y2={10} stroke="var(--ink)" strokeWidth={1.5} />
            <line x1={35} y1={35} x2={18} y2={52} stroke="var(--ink)" strokeWidth={1.5} />
            <text x={63} y={38} fontFamily="JetBrains Mono" fontSize={9} fill="var(--ink)">
              X
            </text>
            <text x={32} y={8} fontFamily="JetBrains Mono" fontSize={9} fill="var(--ink)">
              Y
            </text>
            <text x={10} y={56} fontFamily="JetBrains Mono" fontSize={9} fill="var(--ink)">
              Z
            </text>
          </svg>

          {/* Nav control */}
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'var(--paper)',
              border: '1px solid var(--rule-strong)',
              borderRadius: 999,
              padding: 6,
              boxShadow: '0 10px 40px rgba(0,0,0,.08)',
              zIndex: 5,
            }}
          >
            <button
              disabled={currentStep === 1}
              onClick={() => {
                setCurrentStep(Math.max(1, currentStep - 1));
                setResetTrigger((v) => v + 1);
              }}
              style={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                color: 'var(--ink)',
                cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                opacity: currentStep === 1 ? 0.3 : 1,
              }}
              title="Previous step"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div
              style={{
                padding: '0 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-mute)',
                }}
              >
                Step
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-.01em',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {String(currentStep).padStart(2, '0')}
                <span style={{ color: 'var(--ink-mute)', fontSize: 14 }}>
                  /{String(totalSteps).padStart(2, '0')}
                </span>
              </span>
            </div>
            <button
              disabled={currentStep === totalSteps}
              onClick={() => {
                setCurrentStep(Math.min(totalSteps, currentStep + 1));
                setResetTrigger((v) => v + 1);
              }}
              style={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                color: 'var(--ink)',
                cursor: currentStep === totalSteps ? 'not-allowed' : 'pointer',
                opacity: currentStep === totalSteps ? 0.3 : 1,
              }}
              title="Next step"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          {/* Info card bottom right */}
          <div
            style={{
              position: 'absolute',
              right: 20,
              bottom: 24,
              background: 'var(--paper)',
              border: '1px solid var(--rule-strong)',
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: '0 10px 30px rgba(0,0,0,.06)',
              minWidth: 200,
              zIndex: 4,
            }}
          >
            <div className="mono" style={{ color: 'var(--ink-mute)', marginBottom: 6 }}>
              VIEWPORT
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr',
                gap: '4px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--ink-mute)' }}>parts</span>
              <span>{activeStepData.components.length}</span>
              <span style={{ color: 'var(--ink-mute)' }}>zoom</span>
              <span>{(activeStepData.zoom || 1).toFixed(2)}×</span>
            </div>
          </div>
        </section>

        {/* RIGHT: Steps list / voice or PDF viewer */}
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--paper)',
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {pdfVisible ? (
            <>
              <div
                style={{
                  padding: '20px 24px 16px',
                  borderBottom: '1px solid var(--rule)',
                }}
              >
                <div className="mono" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
                  PDF VIEWER
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {manualData.pdf_filename.replace('.pdf', '')}
                  </h3>
                  <span className="mono" style={{ color: 'var(--ink-mute)' }}>
                    P{currentPdfPage}/{numPages || '—'}
                  </span>
                </div>
              </div>
              <div
                ref={pdfContainerRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  background: 'var(--paper-2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: 16,
                  }}
                >
                  <Document
                    file={getPDFUrl(manualData.pdf_filename, manualData.manual_id)}
                    onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                    loading={
                      <div
                        style={{
                          padding: 40,
                          color: 'var(--ink-mute)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                        }}
                      >
                        LOADING PDF…
                      </div>
                    }
                    error={
                      <div
                        style={{
                          padding: 40,
                          color: 'var(--pop)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                        }}
                      >
                        FAILED TO LOAD PDF
                      </div>
                    }
                  >
                    {numPages &&
                      Array.from(new Array(numPages), (_, index) => (
                        <div
                          key={`page_${index + 1}`}
                          ref={(el) => {
                            pageRefs.current[index] = el;
                          }}
                          style={{ marginBottom: 12 }}
                        >
                          <Page
                            pageNumber={index + 1}
                            width={pdfWidth}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                          />
                        </div>
                      ))}
                  </Document>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--rule)' }}>
                <div className="mono" style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
                  PROJECT
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {manualData.pdf_filename.replace('.pdf', '')}
                </h3>
                <p style={{ color: 'var(--ink-mute)', fontSize: 12, margin: 0 }}>
                  {manualData.components.length} components · {totalSteps} steps
                </p>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
                <div
                  className="mono"
                  style={{ color: 'var(--ink-mute)', padding: '0 24px 10px' }}
                >
                  ASSEMBLY STEPS
                </div>
                {manualData.steps.map((step, i) => {
                  const idx = i + 1;
                  const done = idx < currentStep;
                  const active = idx === currentStep;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setCurrentStep(idx);
                        setResetTrigger((v) => v + 1);
                      }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr auto',
                        gap: 12,
                        padding: '14px 24px',
                        background: active
                          ? 'color-mix(in oklab, var(--pop) 6%, transparent)'
                          : 'transparent',
                        cursor: 'pointer',
                        transition: 'background .15s',
                        width: '100%',
                        textAlign: 'left',
                        borderTopWidth: 0,
                        borderRightWidth: 0,
                        borderBottomWidth: 0,
                        borderLeftWidth: 2,
                        borderLeftStyle: 'solid',
                        borderLeftColor: active ? 'var(--pop)' : 'transparent',
                        color: 'inherit',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = 'var(--chip)';
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          color: done ? 'var(--pop)' : 'var(--ink-mute)',
                          paddingTop: 2,
                        }}
                      >
                        {String(idx).padStart(2, '0')}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            marginBottom: 2,
                            lineHeight: 1.3,
                          }}
                        >
                          {step.title || step.description?.split('.')[0] || `Step ${idx}`}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--ink-mute)',
                            lineHeight: 1.4,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {step.description}
                        </div>
                      </div>
                      <span
                        className="mono"
                        style={{ color: 'var(--ink-mute)', paddingTop: 2 }}
                      >
                        {step.components.length}P
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Voice panel bottom */}
              <div
                style={{
                  borderTop: '1px solid var(--rule)',
                  padding: '18px 24px',
                  background: 'var(--paper-2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="dot" />
                    <span className="mono">ELEVENLABS · NARRATOR</span>
                  </div>
                  <span className="mono" style={{ color: 'var(--ink-mute)' }}>
                    {isPlaying ? 'PLAYING' : 'IDLE'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'end',
                    gap: 2,
                    height: 22,
                    marginBottom: 10,
                  }}
                >
                  {Array.from({ length: 28 }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-block',
                        width: 2,
                        background: 'var(--ink)',
                        height: '100%',
                        transformOrigin: 'center',
                        animation: isPlaying ? `wave 1.2s ease-in-out ${i * 0.05}s infinite` : 'none',
                        transform: isPlaying ? undefined : 'scaleY(0.15)',
                      }}
                    />
                  ))}
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: 14,
                    color: 'var(--ink-soft)',
                    lineHeight: 1.5,
                    padding: '10px 12px',
                    background: 'var(--paper)',
                    border: '1px solid var(--rule)',
                    borderRadius: 8,
                  }}
                >
                  &ldquo;
                  {activeStepData.description.length > 140
                    ? activeStepData.description.slice(0, 140) + '…'
                    : activeStepData.description}
                  &rdquo;
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
