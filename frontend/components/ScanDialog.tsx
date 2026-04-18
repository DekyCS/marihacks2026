"use client";
import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import {
  openScanStream,
  scanBarcode,
  processManual,
  getPDFUrl,
  isDemoManual,
  resolveDemoBarcode,
  BarcodeScanResult,
  ScanStreamEvent,
} from "@/lib/api";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

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

type Stage = "entry" | "agent" | "confirm" | "generating";

interface ScanDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: (result: BarcodeScanResult) => void;
}

export default function ScanDialog({
  open,
  onClose,
  onComplete,
}: ScanDialogProps) {
  const [stage, setStage] = useState<Stage>("entry");
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualCode, setManualCode] = useState("");
  const [detectedCode, setDetectedCode] = useState<string>("");
  const [result, setResult] = useState<BarcodeScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setStage("entry");
      setMode("camera");
      setDetectedCode("");
      setManualCode("");
      setResult(null);
      setErrorMsg(null);
      setIsProcessing(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const startAgent = (code: string) => {
    setDetectedCode(code);
    setTimeout(() => setStage("agent"), 900);
  };

  const onAgentReady = (r: BarcodeScanResult) => {
    setResult(r);
    setStage("confirm");
  };

  const onAgentError = (msg: string) => {
    setErrorMsg(msg);
    setStage("entry");
  };

  const handleConfirm = async () => {
    if (!result) return;
    setIsProcessing(true);
    setStage("generating");
    try {
      if (!DEMO_MODE && !isDemoManual(result.pdf_hash)) {
        await processManual(result.pdf_hash);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Processing failed");
      setIsProcessing(false);
      setStage("confirm");
      return;
    }
  };

  const handleGeneratingComplete = () => {
    if (result) onComplete(result);
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(10,10,10,0.55)",
        backdropFilter: "blur(10px) saturate(140%)",
        WebkitBackdropFilter: "blur(10px) saturate(140%)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        animation: "reveal-up .25s ease",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1180,
          height: "min(88vh, 820px)",
          background: "var(--paper)",
          border: "1px solid var(--rule-strong)",
          borderRadius: 20,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 40px 120px rgba(0,0,0,.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid var(--rule)",
            background: "var(--paper-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div className="mono" style={{ color: "var(--ink-mute)" }}>
              <span style={{ color: "var(--ink)" }}>N° 02</span> / SCAN &amp;
              IMPORT
            </div>
            <span style={{ width: 1, height: 18, background: "var(--rule)" }} />
            <StageBreadcrumb stage={stage} />
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
              display: "grid",
              placeItems: "center",
              border: "1px solid var(--rule)",
              borderRadius: 999,
              background: "transparent",
              cursor: isProcessing ? "not-allowed" : "pointer",
              opacity: isProcessing ? 0.4 : 1,
            }}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {errorMsg && stage === "entry" && (
          <div
            className="mono"
            style={{
              background: "color-mix(in oklab, var(--pop) 8%, var(--paper))",
              color: "var(--ink)",
              padding: "10px 22px",
              borderBottom: "1px solid var(--rule)",
              fontSize: 11,
            }}
          >
            ⚠ {errorMsg}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {stage === "entry" && (
            <StageEntry
              mode={mode}
              setMode={setMode}
              manualCode={manualCode}
              setManualCode={setManualCode}
              onDetect={startAgent}
              detected={detectedCode}
            />
          )}
          {stage === "agent" && (
            <StageAgent
              code={detectedCode || manualCode}
              onReady={onAgentReady}
              onError={onAgentError}
            />
          )}
          {stage === "confirm" && result && (
            <StageConfirm
              result={result}
              onRescan={() => setStage("entry")}
              onConfirm={handleConfirm}
              isProcessing={isProcessing}
            />
          )}
          {stage === "generating" && result && (
            <StageGenerating
              result={result}
              onDone={handleGeneratingComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StageBreadcrumb({ stage }: { stage: Stage }) {
  const steps: { id: Stage; label: string }[] = [
    { id: "entry", label: "Scan" },
    { id: "agent", label: "Fetch" },
    { id: "confirm", label: "Confirm" },
    { id: "generating", label: "Generate" },
  ];
  const idx = steps.findIndex((s) => s.id === stage);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <span
            className="mono"
            style={{
              color: i <= idx ? "var(--ink)" : "var(--ink-mute)",
              fontWeight: i === idx ? 600 : 400,
            }}
          >
            <span style={{ color: "var(--ink-mute)", marginRight: 6 }}>
              0{i + 1}
            </span>
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span
              style={{
                width: 24,
                height: 1,
                background: i < idx ? "var(--ink)" : "var(--rule)",
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// STAGE 1 — ENTRY
function StageEntry({
  mode,
  setMode,
  manualCode,
  setManualCode,
  onDetect,
  detected,
}: {
  mode: "camera" | "manual";
  setMode: (m: "camera" | "manual") => void;
  manualCode: string;
  setManualCode: (c: string) => void;
  onDetect: (c: string) => void;
  detected: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (mode !== "camera" || detected) return;
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
        try {
          video.pause();
        } catch {}
        video.srcObject = null;
      }
    };

    const requestStream = async () => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (err) {
        const name = (err as { name?: string })?.name ?? "";
        if (name === "OverconstrainedError" || name === "NotFoundError") {
          return await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        throw err;
      }
    };

    (async () => {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setCameraError("This browser does not support camera access.");
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
        video.setAttribute("playsinline", "true");
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) resolve();
          else video.onloadedmetadata = () => resolve();
        });
        await video.play().catch(() => {
          throw new Error("Could not start video playback.");
        });
        if (cancelled) {
          stopAll();
          return;
        }

        const controls = await reader.decodeFromVideoElement(
          video,
          (res, _err, ctrl) => {
            if (res && !cancelled && !scannedRef.current) {
              scannedRef.current = true;
              ctrl.stop();
              stopAll();
              onDetect(res.getText());
            }
          },
        );
        if (cancelled) {
          controls.stop();
          stopAll();
          return;
        }
        controlsRef.current = controls;
        setIsStarting(false);
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string })?.name ?? "";
        const msg =
          err instanceof Error ? err.message : "Unable to start camera.";
        let friendly = msg;
        if (name === "NotAllowedError")
          friendly = "Camera permission denied. Use manual input instead.";
        else if (name === "NotFoundError" || name === "OverconstrainedError")
          friendly = "No camera available. Use manual input.";
        else if (name === "NotReadableError")
          friendly = "Camera busy. Close other apps.";
        setCameraError(friendly);
        stopAll();
        setIsStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [mode, detected, onDetect]);

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "1.05fr 1fr",
        gap: 0,
      }}
    >
      {/* LEFT: camera preview */}
      <div
        style={{
          position: "relative",
          background: "#0B0B0D",
          overflow: "hidden",
        }}
      >
        {mode === "camera" ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {isStarting && !cameraError && !detected && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  color: "#f3f1ea",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: "2px solid var(--pop)",
                      borderTopColor: "transparent",
                      borderRadius: 999,
                      animation: "spin-slow 1s linear infinite",
                    }}
                  />
                  <span className="mono">STARTING CAMERA…</span>
                </div>
              </div>
            )}

            <div
              style={{
                position: "absolute",
                inset: "18% 14%",
                borderRadius: 12,
              }}
            >
              <Corner pos="tl" />
              <Corner pos="tr" />
              <Corner pos="bl" />
              <Corner pos="br" />
              {!detected && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 2,
                    background: "var(--pop)",
                    boxShadow: "0 0 16px var(--pop)",
                    animation: "scan-line 2.4s ease-in-out infinite alternate",
                  }}
                />
              )}
            </div>

            <div style={{ position: "absolute", top: 14, left: 14 }}>
              <span
                className="mono"
                style={{
                  background: "rgba(0,0,0,.6)",
                  padding: "5px 9px",
                  borderRadius: 4,
                  color: "#f3f1ea",
                }}
              >
                ● LIVE · 1080p
              </span>
            </div>
            <div style={{ position: "absolute", top: 14, right: 14 }}>
              <span
                className="mono"
                style={{
                  background: "rgba(0,0,0,.6)",
                  padding: "5px 9px",
                  borderRadius: 4,
                  color: "#f3f1ea",
                }}
              >
                ENV CAMERA
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 20,
                textAlign: "center",
                color: "#f3f1ea",
              }}
            >
              <span
                className="mono"
                style={{
                  background: "rgba(0,0,0,.55)",
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontSize: 10,
                }}
              >
                {cameraError
                  ? cameraError
                  : detected
                    ? "BARCODE LOCKED"
                    : "ALIGN BARCODE INSIDE FRAME"}
              </span>
            </div>

            {!detected && !cameraError && (
              <button
                onClick={() => onDetect("885652020954")}
                style={{
                  position: "absolute",
                  bottom: 56,
                  left: "50%",
                  transform: "translateX(-50%)",
                  padding: "10px 16px",
                  borderRadius: 999,
                  background: "var(--pop)",
                  color: "var(--paper)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                ▶ Demo · detect sample barcode
              </button>
            )}

            {detected && (
              <div
                style={{
                  position: "absolute",
                  inset: "18% 14%",
                  border: "2px solid var(--pop)",
                  borderRadius: 12,
                  background:
                    "color-mix(in oklab, var(--pop) 10%, transparent)",
                  animation: "reveal-up .2s ease",
                }}
              />
            )}
          </>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 55% 40%, rgba(255,255,255,.06) 0%, transparent 60%), linear-gradient(180deg, #1a1a1e 0%, #0a0a0c 100%)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <div style={{ textAlign: "center", color: "#f3f1ea" }}>
              <svg
                width={60}
                height={60}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
                style={{ opacity: 0.4 }}
              >
                <rect x={2} y={6} width={20} height={12} rx={2} />
                <path d="M6 10v4M10 10v4M14 10v4M18 10v4" />
              </svg>
              <div className="mono" style={{ marginTop: 16, opacity: 0.6 }}>
                MANUAL ENTRY MODE
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: controls */}
      <div
        style={{
          padding: "36px 36px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          background: "var(--paper)",
          overflowY: "auto",
        }}
      >
        <div>
          <div
            className="mono"
            style={{ color: "var(--ink-mute)", marginBottom: 10 }}
          >
            STAGE 01 · CAPTURE A PRODUCT CODE
          </div>
          <h2 style={{ fontSize: 34, lineHeight: 1.05, marginBottom: 10 }}>
            Point, don&apos;t type.{" "}
            <span className="display-italic" style={{ color: "var(--pop)" }}>
              Usually.
            </span>
          </h2>
          <p
            style={{
              color: "var(--ink-soft)",
              fontSize: 14,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            Scan the barcode on the box or enter the product code. Assembli
            sends a tiny web agent to go find the manual for you.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            border: "1px solid var(--rule)",
            borderRadius: 999,
            alignSelf: "flex-start",
          }}
        >
          <ModeTab
            label="Camera"
            icon="📷"
            active={mode === "camera"}
            onClick={() => setMode("camera")}
          />
          <ModeTab
            label="Enter code"
            icon="⌨"
            active={mode === "manual"}
            onClick={() => setMode("manual")}
          />
        </div>

        {mode === "camera" ? (
          <div>
            <div
              className="mono"
              style={{ color: "var(--ink-mute)", marginBottom: 8 }}
            >
              DETECTED
            </div>
            <div
              style={{
                padding: "16px 18px",
                border: "1px solid var(--rule-strong)",
                borderRadius: 14,
                background: detected ? "var(--pop-soft)" : "var(--paper-2)",
                transition: "background .2s",
              }}
            >
              <div
                className="mono"
                style={{ color: "var(--ink-mute)", marginBottom: 6 }}
              >
                {detected ? "EAN-13 · LOCKED" : "NOTHING YET · ALIGN CAMERA"}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 22,
                  letterSpacing: ".04em",
                  color: detected ? "var(--ink)" : "var(--ink-mute)",
                  minHeight: 30,
                }}
              >
                {detected || "— — — — — — —"}
              </div>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                marginTop: 10,
                lineHeight: 1.5,
              }}
            >
              Supports EAN-13, EAN-8, UPC-A/E, Code-128, QR. Uses ZXing in the
              browser.
            </div>
          </div>
        ) : (
          <div>
            <div
              className="mono"
              style={{ color: "var(--ink-mute)", marginBottom: 8 }}
            >
              PRODUCT CODE
            </div>
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. 7 391846 005810"
              style={{
                width: "100%",
                padding: "14px 16px",
                border: "1px solid var(--rule-strong)",
                borderRadius: 14,
                background: "var(--paper)",
                fontFamily: "var(--font-mono)",
                fontSize: 18,
                letterSpacing: ".03em",
                color: "var(--ink)",
                outline: "none",
              }}
            />
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                marginTop: 10,
                lineHeight: 1.5,
              }}
            >
              Any product code on the box works: EAN, UPC, ASIN, model number.
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={() => {
              setManualCode("");
            }}
          >
            Clear
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              onDetect(
                mode === "camera"
                  ? detected || "885652020954"
                  : manualCode || "885652020954",
              )
            }
            disabled={mode === "manual" && !manualCode.trim()}
            style={{
              opacity: mode === "manual" && !manualCode.trim() ? 0.5 : 1,
              border: "none",
              cursor: "pointer",
            }}
          >
            Find manual →
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeTab({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 500,
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--paper)" : "var(--ink-soft)",
        border: "none",
        cursor: "pointer",
        display: "inline-flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const s: React.CSSProperties = {
    position: "absolute",
    width: 24,
    height: 24,
    border: "2px solid var(--pop)",
  };
  if (pos === "tl")
    Object.assign(s, {
      top: 0,
      left: 0,
      borderRight: "none",
      borderBottom: "none",
    });
  if (pos === "tr")
    Object.assign(s, {
      top: 0,
      right: 0,
      borderLeft: "none",
      borderBottom: "none",
    });
  if (pos === "bl")
    Object.assign(s, {
      bottom: 0,
      left: 0,
      borderRight: "none",
      borderTop: "none",
    });
  if (pos === "br")
    Object.assign(s, {
      bottom: 0,
      right: 0,
      borderLeft: "none",
      borderTop: "none",
    });
  return <div style={s} />;
}

// STAGE 2 — AGENT (TinyFish)
interface AgentStep {
  id: number;
  label: string;
  done: boolean;
  active: boolean;
}

function StageAgent({
  code,
  onReady,
  onError,
}: {
  code: string;
  onReady: (result: BarcodeScanResult) => void;
  onError: (msg: string) => void;
}) {
  const [steps, setSteps] = useState<AgentStep[]>([
    { id: 1, label: "Starting web agent", done: false, active: true },
  ]);
  const [progress, setProgress] = useState(0);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const idCounterRef = useRef(1);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onReady, onError]);

  useEffect(() => {
    if (DEMO_MODE) {
      scanBarcode(code)
        .then((r) => {
          const plan = [
            { at: 700, label: "Resolve code → product" },
            { at: 1600, label: "Navigate to source" },
            { at: 2600, label: "Open product page" },
            { at: 3600, label: "Locate manual PDF" },
            { at: 4600, label: "Downloading PDF" },
          ];
          const timers: ReturnType<typeof setTimeout>[] = [];
          plan.forEach((ev) => {
            timers.push(
              setTimeout(() => {
                setSteps((prev) => {
                  const marked = prev.map((s) => ({
                    ...s,
                    done: true,
                    active: false,
                  }));
                  return [
                    ...marked,
                    {
                      id: ++idCounterRef.current,
                      label: ev.label,
                      done: false,
                      active: true,
                    },
                  ];
                });
              }, ev.at),
            );
          });
          timers.push(
            setTimeout(() => {
              setSteps((prev) =>
                prev.map((s) => ({ ...s, done: true, active: false })),
              );
              onReadyRef.current(r);
            }, 5400),
          );

          const start = performance.now();
          let raf: number;
          const tick = (t: number) => {
            const pct = Math.min(100, ((t - start) / 5400) * 100);
            setProgress(pct);
            if (pct < 100) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          return () => {
            timers.forEach(clearTimeout);
            cancelAnimationFrame(raf);
          };
        })
        .catch((err) => {
          onErrorRef.current(
            err instanceof Error ? err.message : "Lookup failed",
          );
        });
      return;
    }

    if (esRef.current) return;
    const es = openScanStream(code);
    esRef.current = es;
    const start = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const pct = Math.min(97, ((t - start) / 90000) * 100);
      setProgress(pct);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const pushStep = (label: string) => {
      setSteps((prev) => {
        const marked = prev.map((s) => ({ ...s, done: true, active: false }));
        return [
          ...marked,
          { id: ++idCounterRef.current, label, done: false, active: true },
        ];
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
        case "STARTED":
          break;
        case "STREAMING_URL":
          setStreamingUrl(event.streaming_url);
          break;
        case "PROGRESS":
          if (event.purpose) pushStep(event.purpose);
          break;
        case "COMPLETE":
          setSteps((prev) =>
            prev.map((s) => ({ ...s, done: true, active: false })),
          );
          break;
        case "DOWNLOADING":
          pushStep("Downloading PDF");
          break;
        case "READY": {
          setSteps((prev) =>
            prev.map((s) => ({ ...s, done: true, active: false })),
          );
          setProgress(100);
          cancelAnimationFrame(raf);
          es.close();
          esRef.current = null;
          const demoId = resolveDemoBarcode(code);
          if (demoId) {
            scanBarcode(code)
              .then((demoResult) => onReadyRef.current(demoResult))
              .catch(() =>
                onReadyRef.current({
                  pdf_hash: event.pdf_hash,
                  filename: event.filename,
                  product_name: event.product_name,
                  source_url: event.source_url,
                }),
              );
          } else {
            onReadyRef.current({
              pdf_hash: event.pdf_hash,
              filename: event.filename,
              product_name: event.product_name,
              source_url: event.source_url,
            });
          }
          break;
        }
        case "ERROR": {
          cancelAnimationFrame(raf);
          es.close();
          esRef.current = null;
          const demoId = resolveDemoBarcode(code);
          if (demoId) {
            scanBarcode(code)
              .then((demoResult) => onReadyRef.current(demoResult))
              .catch(() => onErrorRef.current(event.message));
          } else {
            onErrorRef.current(event.message);
          }
          break;
        }
      }
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      cancelAnimationFrame(raf);
      es.close();
      esRef.current = null;
      onErrorRef.current("Connection lost while streaming agent events.");
    };

    return () => {
      cancelAnimationFrame(raf);
      es.close();
      esRef.current = null;
    };
  }, [code]);

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 0,
      }}
    >
      <aside
        style={{
          background: "var(--paper-2)",
          borderRight: "1px solid var(--rule)",
          padding: "22px 20px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <div
            className="mono"
            style={{ color: "var(--ink-mute)", marginBottom: 6 }}
          >
            PRODUCT CODE
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 15,
              letterSpacing: ".02em",
            }}
          >
            {code}
          </div>
        </div>

        <div style={{ height: 1, background: "var(--rule)" }} />

        <div>
          <div
            className="mono"
            style={{ color: "var(--ink-mute)", marginBottom: 12 }}
          >
            AGENT STEPS
          </div>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 12,
            }}
          >
            {steps.map((s) => (
              <li
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "start",
                  gap: 10,
                  animation: "reveal-up .35s ease",
                }}
              >
                <StepIcon done={s.done} active={s.active} />
                <span
                  style={{
                    fontSize: 13,
                    color:
                      s.done || s.active ? "var(--ink)" : "var(--ink-mute)",
                    lineHeight: 1.4,
                  }}
                >
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div style={{ marginTop: "auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ink-mute)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            <span>PROGRESS</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div
            style={{
              height: 3,
              background: "var(--rule)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "var(--pop)",
                width: `${progress}%`,
                transition: "width .2s ease",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 12,
              color: "var(--ink-mute)",
              lineHeight: 1.5,
            }}
          >
            <span className="serif-ital" style={{ color: "var(--ink)" }}>
              While you wait,
            </span>{" "}
            grab a coffee. This takes about 90 seconds.
          </div>
        </div>
      </aside>

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          background: "var(--paper)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderBottom: "1px solid var(--rule)",
            background: "var(--paper-2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", gap: 4 }}>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "var(--rule-strong)",
                }}
              />
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "var(--rule-strong)",
                }}
              />
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: "var(--rule-strong)",
                }}
              />
            </span>
            <span className="mono" style={{ color: "var(--ink-mute)" }}>
              TINYFISH · LIVE BROWSER
            </span>
          </div>
          <span className="mono" style={{ color: "var(--pop)" }}>
            ● STREAMING
          </span>
        </div>

        <div
          style={{ flex: 1, overflow: "hidden", background: "var(--paper-2)" }}
        >
          {streamingUrl ? (
            <iframe
              src={streamingUrl}
              title="Live agent browser"
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="fullscreen"
            />
          ) : (
            <FakeBrowserPage progress={progress} />
          )}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--rule)",
            padding: "8px 14px",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--ink-mute)",
            background: "var(--paper-2)",
          }}
        >
          <span>PROGRESS {Math.round(progress)}%</span>
          <span>TOKENS {Math.round(progress * 14)}</span>
          <span>NET {Math.round(progress * 0.5)} REQ</span>
          <span style={{ color: "var(--pop)" }}>● LIVE</span>
        </div>
      </div>
    </div>
  );
}

function StepIcon({ done, active }: { done: boolean; active: boolean }) {
  if (done)
    return (
      <span
        style={{
          marginTop: 3,
          width: 14,
          height: 14,
          borderRadius: 999,
          background: "var(--pop)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <svg
          width={8}
          height={8}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={4}
        >
          <path d="M4 12l5 5L20 6" />
        </svg>
      </span>
    );
  if (active)
    return (
      <span
        style={{
          marginTop: 3,
          width: 14,
          height: 14,
          borderRadius: 999,
          border: "2px solid var(--pop)",
          borderTopColor: "transparent",
          animation: "spin-slow 1s linear infinite",
          flexShrink: 0,
        }}
      />
    );
  return (
    <span
      style={{
        marginTop: 5,
        width: 10,
        height: 10,
        borderRadius: 999,
        border: "1.5px solid var(--rule-strong)",
        flexShrink: 0,
      }}
    />
  );
}

function FakeBrowserPage({ progress: _progress }: { progress: number }) {
  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            border: "2px solid var(--pop)",
            borderTopColor: "transparent",
            borderRadius: 999,
            animation: "spin-slow 1s linear infinite",
          }}
        />
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 500,
          }}
        >
          Loading up TinyFish agent…
        </div>
      </div>
    </div>
  );
}

// STAGE 3 — CONFIRM
function StageConfirm({
  result,
  onRescan,
  onConfirm,
  isProcessing,
}: {
  result: BarcodeScanResult;
  onRescan: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}) {
  const pdfUrl = getPDFUrl(result.filename, result.pdf_hash);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "22px 28px 16px",
          borderBottom: "1px solid var(--rule)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 24,
        }}
      >
        <div>
          <div
            className="mono"
            style={{ color: "var(--ink-mute)", marginBottom: 8 }}
          >
            STAGE 03 · CONFIRM
          </div>
          <h2 style={{ fontSize: 30, lineHeight: 1.05, marginBottom: 6 }}>
            Is this the{" "}
            <span className="display-italic" style={{ color: "var(--pop)" }}>
              right
            </span>{" "}
            manual?
          </h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13, margin: 0 }}>
            {result.product_name}
            {result.source_url && result.source_url !== "demo://local" && (
              <>
                {" · pulled from "}
                <a
                  href={result.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--ink)" }}
                >
                  {new URL(result.source_url).hostname}
                </a>
              </>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            className="btn btn-ghost"
            onClick={onRescan}
            disabled={isProcessing}
          >
            ↻ Rescan
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={isProcessing}
            style={{
              border: "none",
              cursor: isProcessing ? "not-allowed" : "pointer",
            }}
          >
            {isProcessing ? "Processing…" : "✓ Generate 3D guide"}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, overflow: "hidden" }}>
        <iframe
          src={pdfUrl}
          title="Manual preview"
          style={{
            width: "100%",
            height: "100%",
            border: "1px solid var(--rule-strong)",
            borderRadius: 12,
            background: "var(--paper-2)",
          }}
        />
      </div>
    </div>
  );
}

// STAGE 4 — GENERATING
function StageGenerating({
  result,
  onDone,
}: {
  result: BarcodeScanResult;
  onDone: () => void;
}) {
  const DURATION = 4200;
  const [progress, setProgress] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  const steps = [
    "Parsing PDF structure",
    "Extracting components",
    "Reconstructing 3D geometry",
    "Syncing narration tracks",
    "Finalizing workspace",
  ];

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const pct = Math.min(100, ((t - start) / DURATION) * 100);
      setProgress(pct);
      setActiveIdx(
        Math.min(steps.length - 1, Math.floor((pct / 100) * steps.length)),
      );
      if (pct < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = setTimeout(onDone, DURATION);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr",
        background: "var(--paper)",
      }}
    >
      {/* LEFT: 3D orb animation */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(circle at 50% 55%, color-mix(in oklab, var(--pop) 14%, #0B0B0D) 0%, #0B0B0D 70%)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          className="grid-bg"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.2,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            width: "min(78%, 360px)",
            aspectRatio: "1 / 1",
          }}
        >
          <svg
            viewBox="0 0 400 400"
            style={{ width: "100%", height: "100%", display: "block" }}
          >
            <circle
              cx="200"
              cy="200"
              r="140"
              fill="none"
              stroke="rgba(243,241,234,.08)"
              strokeWidth={6}
            />
            <circle
              cx="200"
              cy="200"
              r="140"
              fill="none"
              stroke="var(--pop)"
              strokeWidth={6}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100 100"
              strokeDashoffset={100 - progress}
              transform="rotate(-90 200 200)"
              style={{ transition: "stroke-dashoffset .15s linear" }}
            />
            {Array.from({ length: 18 }).map((_, i) => {
              const a = (i / 18) * Math.PI * 2;
              const x = 200 + Math.cos(a) * 180;
              const y = 200 + Math.sin(a) * 180;
              const lit = (i / 18) * 100 <= progress;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={2.5}
                  fill={lit ? "var(--pop)" : "rgba(243,241,234,.14)"}
                  style={{ transition: "fill .3s ease" }}
                />
              );
            })}
          </svg>

          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 44,
              height: 44,
              borderRadius: 999,
              border: "2px solid var(--pop)",
              animation: "ring 2.4s ease-out infinite",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "var(--pop)",
              boxShadow: "0 0 20px var(--pop)",
              animation: "pulse-dot 2.4s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: 28,
            right: 28,
            color: "#f3f1ea",
          }}
        >
          <div
            className="mono"
            style={{
              color: "rgba(243,241,234,.55)",
              fontSize: 10,
              marginBottom: 10,
            }}
          >
            ● GENERATING · {Math.round(progress)}%
          </div>
          <div
            style={{
              height: 3,
              background: "rgba(243,241,234,.12)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "var(--pop)",
                transition: "width .15s linear",
                boxShadow: "0 0 12px var(--pop)",
              }}
            />
          </div>
        </div>
      </div>

      {/* RIGHT: text + step list */}
      <div
        style={{
          padding: "40px 44px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          justifyContent: "center",
        }}
      >
        <div className="mono" style={{ color: "var(--ink-mute)" }}>
          STAGE 04 · GENERATE
        </div>
        <h2 style={{ fontSize: 38, lineHeight: 1.05, margin: 0 }}>
          Building your{" "}
          <span className="display-italic" style={{ color: "var(--pop)" }}>
            3D guide.
          </span>
        </h2>
        <p
          style={{
            color: "var(--ink-soft)",
            fontSize: 14,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Reassembling <b>{result.product_name}</b> into an interactive,
          voice-narrated workspace. Hold tight — this only takes a moment.
        </p>

        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: "8px 0 0",
            display: "grid",
            gap: 12,
          }}
        >
          {steps.map((label, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <li
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <StepIcon done={done} active={active} />
                <span
                  style={{
                    fontSize: 14,
                    color: done || active ? "var(--ink)" : "var(--ink-mute)",
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
