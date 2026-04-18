"use client"

import React, { useState, useEffect, use, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  RotateCcw,
  FileText,
  Volume2,
  VolumeX,
  Loader2
} from 'lucide-react';
import dynamic from 'next/dynamic';
import AssemblyScene from '@/components/AssemblyScene';
import ChatAgent from '@/components/ChatAgent';
import {
  fetchManualJSON,
  getComponentModelUrl,
  getStepAudioUrl,
  getPDFUrl,
  type ManualJSON,
  type StepData,
  type Component
} from '@/lib/api';
import { generateTTS } from '@/lib/tts';

// Dynamically import react-pdf to avoid SSR issues with DOMMatrix
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { ssr: false });
const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), { ssr: false });

// Configure PDF.js worker (only on client side)
if (typeof window !== 'undefined') {
  import('react-pdf').then(({ pdfjs }) => {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  });
}

interface WorkspaceProps {
  params: Promise<{
    id: string;
  }>;
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

  // PDF viewer state
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfWidth, setPdfWidth] = useState<number>(600);
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(1);
  const pdfContainerRef = React.useRef<HTMLDivElement>(null);
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
        console.error("Failed to load manual", err);
        setError("Failed to load instruction manual. Make sure the backend server is running.");
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

    const timer = setTimeout(() => {
      setInitialDelayComplete(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [manualData, loading]);

  useEffect(() => {
    if (!activeStepData || !activeStepData.description) return;
    if (!initialDelayComplete) return;

    // Skip TTS when Vapi voice assistant is active
    if (isVapiActive) {
      prevVapiActiveRef.current = true;
      return;
    }

    // Skip TTS if we just hung up Vapi and we're on the same step
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
          if (currentStepRef.current === stepForThisAudio) {
            setIsPlaying(true);
          }
        };
        audio.onended = () => {
          if (currentStepRef.current === stepForThisAudio) {
            setIsPlaying(false);
          }
        };
        audio.onerror = () => {
          // Silently handle audio errors
          if (currentStepRef.current === stepForThisAudio) {
            setIsPlaying(false);
          }
        };

        if (currentStepRef.current === stepForThisAudio) {
          audio.play().catch(() => {
            // Silently handle autoplay restrictions
            if (currentStepRef.current === stepForThisAudio) {
              setIsPlaying(false);
            }
          });
        } else {
          URL.revokeObjectURL(audioUrl);
        }
      })
      .catch(() => {
        // Silently handle TTS errors
        if (!abortController.signal.aborted) {
          if (currentStepRef.current === stepForThisAudio) {
            setIsPlaying(false);
          }
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
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Update PDF width based on container size
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
  }, []);

  // Track current PDF page
  useEffect(() => {
    if (!pdfContainerRef.current || !numPages) return;

    const options = {
      root: pdfContainerRef.current,
      rootMargin: '-10% 0px -90% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
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
  }, [numPages, pageRefs]);

  useEffect(() => {
    if (!initialDelayComplete) return;
    if (!activeStepData?.page_number || !pdfContainerRef.current || !numPages) return;

    const page_number = activeStepData.page_number;
    const pageElement = pageRefs.current[page_number];

    if (!pageElement || page_number < 0 || page_number >= numPages) {
      return;
    }

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

      pdfContainerRef.current.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    };

    if (pageElement.offsetHeight === 0) {
      const timer = setTimeout(() => {
        if (pageElement.offsetHeight > 0) {
          performScroll();
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    performScroll();
  }, [currentStep, activeStepData, numPages, initialDelayComplete]);

  const getComponentsForScene = () => {
    if (!manualData || !activeStepData) return [];

    const componentCounts: Record<string, number> = {};

    return activeStepData.components.map((compId, index) => {
      const component = manualData.components.find(c => c.id === compId);
      if (!component || !component.model_path) return null;

      if (!componentCounts[compId]) {
        componentCounts[compId] = 0;
      }
      const occurrenceIndex = componentCounts[compId];
      componentCounts[compId]++;

      const indexedKey = `${compId}_${occurrenceIndex}`;
      let positionData = activeStepData.component_positions[indexedKey];

      if (!positionData) {
        positionData = activeStepData.component_positions[compId];
      }

      if (!positionData) return null;

      const isMoving = !!positionData.movement;

      return {
        modelUrl: getComponentModelUrl(component, manualData.manual_id),
        isMoving,
        position: {
          x: positionData.x,
          y: positionData.y,
          z: positionData.z
        },
        rotation: positionData.rotation || { x: 0, y: 0, z: 0 },
        scale: positionData.scale || { x: 1, y: 1, z: 1 },
        movement: positionData.movement
      };
    }).filter(Boolean) as Array<{
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
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-900 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
        <h2 className="text-xl font-semibold">Loading 3D Manual...</h2>
        <p className="text-zinc-500">Fetching assets and instructions</p>
      </div>
    );
  }

  if (error || !manualData || !activeStepData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-900 text-white">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-500 mb-2">Error</h2>
          <p>{error || "Manual not found"}</p>
          <a href="/" className="mt-4 inline-block text-purple-400 hover:underline">Return to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-zinc-900 font-sans text-white overflow-hidden">

      <header className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
            <span className="font-semibold text-zinc-100">{manualData.pdf_filename.replace('.pdf', '')}</span>
          </nav>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* LEFT PANEL: 3D VIEWER */}
        <div className="w-full md:w-[60%] bg-black relative h-1/2 md:h-full order-2 md:order-1">

          <div className="absolute inset-0 z-0">
            <AssemblyScene
              components={getComponentsForScene()}
              resetTrigger={resetTrigger}
              zoomLevel={activeStepData?.zoom || 1}
            />
          </div>

          {activeStepData && (
            <div className="absolute top-6 left-6 z-20 flex justify-start pointer-events-none">
               <div className="glass-navbar light-glass-navbar p-4 md:p-6 rounded-2xl shadow-2xl max-w-md pointer-events-auto">
                  <div className="flex items-center gap-3 mb-2">
                     <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Step {currentStep}</span>
                     {isPlaying && (
                       <span className="text-xs text-green-400 animate-pulse">● Speaking</span>
                     )}
                  </div>
                  <p className="text-xs md:text-sm font-medium text-white leading-relaxed text-left">
                    {activeStepData.description}
                  </p>
               </div>
            </div>
          )}

          <div className='absolute bottom-8 right-8'>
            <div className="glass-navbar light-glass-navbar rounded-full flex items-center gap-2 p-1 z-30">
              <button
                onClick={() => {
                  setCurrentStep(Math.max(1, currentStep - 1));
                  setResetTrigger(prev => prev + 1);
                }}
                disabled={currentStep === 1}
                className="group p-3 rounded-xl disabled:opacity-30 transition-all"
              >
                <ArrowLeft className="w-6 h-6 text-zinc-200 group-hover:text-purple-400 transition-colors" />
              </button>

              <div className="flex flex-col items-center px-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Step</span>
                <span className="text-xl font-bold text-white tabular-nums leading-none">{currentStep}</span>
              </div>

              <button
                onClick={() => {
                  setCurrentStep(Math.min(totalSteps, currentStep + 1));
                  setResetTrigger(prev => prev + 1);
                }}
                disabled={currentStep === totalSteps}
                className="group p-3 rounded-xl disabled:opacity-30 transition-all"
              >
                <ArrowRight className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition-all" />
              </button>
            </div>
          </div>

          <div className="absolute top-6 right-6 flex gap-2 z-30">
             <ChatAgent
               manualId={manualData.manual_id}
               steps={manualData.steps}
               currentStep={currentStep}
               onGotoStep={(stepNumber) => {
                 setCurrentStep(Math.max(1, Math.min(totalSteps, stepNumber)));
               }}
               onVapiStateChange={(active) => {
                 setIsVapiActive(active);
                 // Pause step narration when Vapi becomes active
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
                   audioRef.current.play().catch(() => {
                     if (activeStepData?.description) {
                       generateTTS(activeStepData.description, currentStep)
                         .then((audioUrl) => {
                           if (audioRef.current) {
                             audioRef.current.pause();
                           }
                           const audio = new Audio(audioUrl);
                           audioRef.current = audio;
                           audio.muted = isMuted;
                           audio.currentTime = 0;
                           audio.onplay = () => setIsPlaying(true);
                           audio.onended = () => {
                             setIsPlaying(false);
                           };
                           audio.play();
                         })
                         .catch(() => {});
                     }
                   });
                 } else if (activeStepData?.description) {
                   generateTTS(activeStepData.description, currentStep)
                     .then((audioUrl) => {
                       const audio = new Audio(audioUrl);
                       audioRef.current = audio;
                       audio.muted = isMuted;
                       audio.currentTime = 0;
                       audio.onplay = () => setIsPlaying(true);
                       audio.onended = () => {
                         setIsPlaying(false);
                       };
                       audio.play();
                     })
                     .catch(() => {});
                 }
               }}
               className="glass-navbar light-glass-navbar p-2 hover:bg-purple-600/20 rounded-full text-zinc-300 hover:text-white transition-all"
               title="Replay audio"
             >
               <RotateCcw className="w-5 h-5" />
             </button>
             <button
               onClick={() => setIsMuted(!isMuted)}
               className="glass-navbar light-glass-navbar p-2 hover:bg-purple-600/20 rounded-full text-zinc-300 hover:text-white transition-all"
               title={isMuted ? "Unmute audio" : "Mute audio"}
             >
               {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
             </button>
          </div>

        </div>

        {/* RIGHT PANEL: PDF VIEWER */}
        <div className="w-full md:w-[40%] border-b md:border-b-0 md:border-l border-zinc-700 relative flex flex-col h-1/2 md:h-full order-1 md:order-2">
          {/* Glass navbar overlaying PDF */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[calc(100%-4rem)] max-w-lg pointer-events-none">
            <div className="glass-navbar dark-glass-navbar rounded-full h-12 flex items-center justify-between px-5 pointer-events-auto">
              <span className="text-xs font-medium text-black flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {manualData.pdf_filename.replace('.pdf', '')}
              </span>
              <span className="text-xs px-3 py-1.5 rounded-full text-black font-medium">
                Page {currentPdfPage} of {numPages}
              </span>
            </div>
          </div>

          {/* PDF VIEWER CONTAINER */}
          <div ref={pdfContainerRef} className="flex-1 bg-zinc-900 relative overflow-y-auto">
            <div className="flex flex-col items-center py-4">
              <Document
                file={getPDFUrl(manualData.pdf_filename, manualData.manual_id)}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                  </div>
                }
                error={
                  <div className="flex items-center justify-center py-12 text-red-500">
                    Failed to load PDF
                  </div>
                }
              >
                {numPages && Array.from(new Array(numPages), (_, index) => (
                  <div
                    key={`page_${index + 1}`}
                    ref={(el) => { pageRefs.current[index] = el; }}
                  >
                    <Page
                      pageNumber={index + 1}
                      width={pdfWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      className="mb-4"
                    />
                  </div>
                ))}
              </Document>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
