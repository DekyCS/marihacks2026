"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchManuals, uploadPDF, processManual, BarcodeScanResult } from '@/lib/api';
import ScanDialog from '@/components/ScanDialog';
import ProductThumbnail from '@/components/ProductThumbnail';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

interface Project {
  id: string;
  title: string;
}

export default function UploadHub() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    loadManuals();
  }, []);

  async function loadManuals() {
    try {
      setIsLoading(true);
      const manuals = await fetchManuals();
      setProjects(
        manuals.map((m) => ({ id: m.hash, title: m.name || m.filename.replace('.pdf', '') }))
      );
      setError(null);
    } catch {
      setError('Failed to load projects. Make sure the backend server is running.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploading(true);
    setError(null);
    setUploadProgress('Uploading PDF…');
    try {
      const result = await uploadPDF(file);
      setUploadProgress('Processing manual…');
      await processManual(result.pdf_hash);
      setUploadProgress('Complete');
      await loadManuals();
      router.push(`/workspace/${result.pdf_hash}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
      setUploadProgress('');
    }
    e.target.value = '';
  };

  const handleScanComplete = (result: BarcodeScanResult) => {
    setScanOpen(false);
    router.push(`/workspace/${result.pdf_hash}`);
  };

  return (
    <div className="page">
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'color-mix(in oklab, var(--paper) 92%, transparent)',
          backdropFilter: 'blur(12px) saturate(140%)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div
          className="container-pad"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <rect x={3} y={3} width={18} height={18} rx={3} stroke="currentColor" strokeWidth={1.6} />
              <path d="M3 9 L21 9" stroke="currentColor" strokeWidth={1.6} />
              <circle cx={7} cy={6} r={0.9} fill="currentColor" />
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: '-.01em',
              }}
            >
              ManualY
            </span>
          </Link>
          <nav style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span className="mono" style={{ color: 'var(--ink-mute)' }}>
              DASHBOARD
            </span>
            <span className="chip">
              <span className="dot" />
              {projects.length} MANUAL{projects.length !== 1 ? 'S' : ''}
            </span>
          </nav>
        </div>
      </header>

      <main style={{ position: 'relative' }}>
        <div
          className="grid-bg"
          style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }}
        />
        <div
          className="noise"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        />

        <div
          className="container-pad"
          style={{ position: 'relative', paddingTop: 80, paddingBottom: 120 }}
        >
          <div style={{ maxWidth: 860, marginBottom: 56 }}>
            <div className="mono" style={{ color: 'var(--ink-mute)', marginBottom: 14 }}>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>N° 01</span>
              <span style={{ width: 32, height: 1, background: 'var(--ink)', display: 'inline-block', margin: '0 14px', verticalAlign: 'middle' }} />
              START A NEW GUIDE
            </div>
            <h1 style={{ fontSize: 'clamp(40px, 6vw, 80px)', lineHeight: 0.98, marginBottom: 18 }}>
              Bring in your{' '}
              <span className="display-italic" style={{ color: 'var(--pop)' }}>
                manual.
              </span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--ink-soft)', maxWidth: 540 }}>
              Scan the box, enter a product code, or drop in a PDF. ManualY will rebuild it as an
              interactive 3D guide with voice narration.
            </p>
            {error && (
              <div
                className="mono"
                style={{
                  marginTop: 18,
                  padding: '10px 14px',
                  border: '1px solid var(--rule-strong)',
                  borderRadius: 12,
                  background: 'color-mix(in oklab, var(--pop) 5%, var(--paper))',
                  color: 'var(--ink)',
                  display: 'inline-block',
                }}
              >
                ⚠ {error}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 18,
              marginBottom: 80,
            }}
          >
            {/* SCAN OPTION */}
            <button
              onClick={() => setScanOpen(true)}
              disabled={isUploading}
              style={{
                position: 'relative',
                textAlign: 'left',
                padding: 28,
                border: '1px solid var(--rule-strong)',
                borderRadius: 20,
                background: 'var(--paper-2)',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.5 : 1,
                transition: 'transform .2s ease, border-color .2s ease',
                fontFamily: 'var(--font-body)',
                color: 'inherit',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--ink)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--rule-strong)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <span className="mono" style={{ color: 'var(--pop)' }}>
                  01 · SCAN
                </span>
                <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
                <span className="mono" style={{ color: 'var(--ink-mute)' }}>
                  RECOMMENDED
                </span>
              </div>

              <div
                style={{
                  aspectRatio: '16/10',
                  borderRadius: 12,
                  background: '#0B0B0D',
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: 22,
                }}
              >
                <svg
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  viewBox="0 0 400 250"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <linearGradient id="box-scan" x1={0} y1={0} x2={1} y2={1}>
                      <stop offset={0} stopColor="#c9a770" />
                      <stop offset={1} stopColor="#8a6f45" />
                    </linearGradient>
                  </defs>
                  <g transform="translate(200 135)">
                    <polygon points="-100,-70 100,-70 125,-40 -75,-40" fill="#e8d5a8" />
                    <polygon points="-100,-70 -100,60 -75,90 -75,-40" fill="url(#box-scan)" />
                    <polygon points="100,-70 100,60 125,90 125,-40" fill="#a8895a" />
                    <polygon points="-75,-40 125,-40 125,90 -75,90" fill="#d4b685" />
                    <g transform="translate(-40 10)">
                      <rect width={120} height={50} fill="#f7efdc" stroke="#3a2c15" strokeWidth={0.5} />
                      <g fill="#0a0a0a">
                        {[3, 4, 6, 3, 2, 5, 2, 3, 4, 2, 3, 5, 2, 4, 3].map((w, i) => (
                          <rect key={i} x={8 + i * 7} y={6} width={w * 0.6} height={32} />
                        ))}
                      </g>
                    </g>
                  </g>
                </svg>

                <div style={{ position: 'absolute', inset: '22% 18%' }}>
                  <Corner pos="tl" />
                  <Corner pos="tr" />
                  <Corner pos="bl" />
                  <Corner pos="br" />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: 2,
                      background: 'var(--pop)',
                      boxShadow: '0 0 16px var(--pop)',
                      animation: 'scan-line 2.4s ease-in-out infinite alternate',
                    }}
                  />
                </div>

                <span
                  className="mono"
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 10,
                    background: 'rgba(0,0,0,.6)',
                    padding: '4px 8px',
                    borderRadius: 4,
                    color: '#f3f1ea',
                    fontSize: 9,
                  }}
                >
                  ● LIVE · PREVIEW
                </span>
              </div>

              <h3 style={{ fontSize: 24, marginBottom: 8, letterSpacing: '-0.015em' }}>
                Scan a product code
              </h3>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0 }}>
                Point your camera at a barcode. We send a tiny web agent to fetch the manual for you.
              </p>

              <div
                className="mono"
                style={{
                  marginTop: 22,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: 'var(--ink)',
                }}
              >
                Start scanning →
              </div>
            </button>

            {/* UPLOAD OPTION */}
            <label
              style={{
                position: 'relative',
                display: 'block',
                padding: 28,
                border: '1px dashed var(--rule-strong)',
                borderRadius: 20,
                background: 'var(--paper)',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                transition: 'border-color .2s ease, background .2s ease',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.borderColor = 'var(--ink)';
                  e.currentTarget.style.background = 'var(--paper-2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--rule-strong)';
                e.currentTarget.style.background = 'var(--paper)';
              }}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={isUploading || DEMO_MODE}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                <span className="mono" style={{ color: 'var(--ink-mute)' }}>
                  02 · UPLOAD
                </span>
                <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
                {DEMO_MODE && (
                  <span className="mono" style={{ color: 'var(--ink-mute)' }}>
                    DISABLED IN DEMO
                  </span>
                )}
              </div>

              <div
                style={{
                  aspectRatio: '16/10',
                  borderRadius: 12,
                  background: 'var(--paper-2)',
                  border: '1px dashed var(--rule-strong)',
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: 22,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {isUploading ? (
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
                        marginBottom: 12,
                      }}
                    />
                    <div className="mono" style={{ color: 'var(--ink)' }}>
                      {uploadProgress}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <svg
                      width={56}
                      height={56}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.2}
                      style={{ color: 'var(--ink-soft)' }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                      <path d="M12 18v-6" />
                      <path d="M9 15l3-3 3 3" />
                    </svg>
                    <div
                      className="mono"
                      style={{ color: 'var(--ink-mute)', marginTop: 12 }}
                    >
                      DROP PDF OR CLICK TO BROWSE
                    </div>
                  </div>
                )}
              </div>

              <h3 style={{ fontSize: 24, marginBottom: 8, letterSpacing: '-0.015em' }}>
                Upload a PDF manual
              </h3>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.5, margin: 0 }}>
                Already have the PDF? Drop it in. Works with IKEA, electronics, anything legible.
              </p>

              <div
                className="mono"
                style={{
                  marginTop: 22,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: 'var(--ink)',
                }}
              >
                Upload PDF →
              </div>
            </label>
          </div>

          {/* PROJECTS GRID */}
          <div style={{ borderTop: '1px solid var(--rule-strong)', paddingTop: 40 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 24,
              }}
            >
              <div className="mono" style={{ color: 'var(--ink-mute)' }}>
                <span style={{ color: 'var(--ink)', fontWeight: 600 }}>N° 02</span>
                <span
                  style={{
                    width: 32,
                    height: 1,
                    background: 'var(--ink)',
                    display: 'inline-block',
                    margin: '0 14px',
                    verticalAlign: 'middle',
                  }}
                />
                YOUR MANUALS
              </div>
              <span className="mono" style={{ color: 'var(--ink-mute)' }}>
                {projects.length} ITEM{projects.length !== 1 ? 'S' : ''}
              </span>
            </div>

            {isLoading ? (
              <div
                style={{
                  padding: 40,
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--ink-mute)',
                }}
                className="mono"
              >
                Loading…
              </div>
            ) : projects.length === 0 ? (
              <div
                style={{
                  padding: '60px 24px',
                  textAlign: 'center',
                  color: 'var(--ink-mute)',
                  border: '1px dashed var(--rule)',
                  borderRadius: 18,
                }}
              >
                <span className="serif-ital" style={{ fontSize: 20, color: 'var(--ink)' }}>
                  No manuals yet.
                </span>
                <p style={{ margin: '6px 0 0', fontSize: 13 }}>Scan a product or upload a PDF to begin.</p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 14,
                }}
              >
                {projects.map((project, i) => (
                  <Link
                    key={project.id}
                    href={`/workspace/${project.id}`}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                      padding: 18,
                      border: '1px solid var(--rule)',
                      borderRadius: 16,
                      background: 'var(--paper)',
                      transition: 'border-color .2s ease, transform .2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--ink)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--rule)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: '3/2',
                        background: 'var(--paper-2)',
                        borderRadius: 10,
                        border: '1px solid var(--rule)',
                        marginBottom: 14,
                        display: 'grid',
                        placeItems: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <ProductThumbnail manualId={project.id} />
                      <span
                        className="mono"
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          color: 'var(--ink-mute)',
                          fontSize: 9,
                          zIndex: 1,
                        }}
                      >
                        ID {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 15,
                          fontWeight: 500,
                          letterSpacing: '-0.01em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {project.title}
                      </span>
                      <span className="mono" style={{ color: 'var(--ink-mute)' }}>
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <ScanDialog open={scanOpen} onClose={() => setScanOpen(false)} onComplete={handleScanComplete} />
    </div>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s: React.CSSProperties = {
    position: 'absolute',
    width: 18,
    height: 18,
    border: '2px solid var(--pop)',
  };
  if (pos === 'tl') Object.assign(s, { top: 0, left: 0, borderRight: 'none', borderBottom: 'none' });
  if (pos === 'tr') Object.assign(s, { top: 0, right: 0, borderLeft: 'none', borderBottom: 'none' });
  if (pos === 'bl') Object.assign(s, { bottom: 0, left: 0, borderRight: 'none', borderTop: 'none' });
  if (pos === 'br') Object.assign(s, { bottom: 0, right: 0, borderLeft: 'none', borderTop: 'none' });
  return <div style={s} />;
}
