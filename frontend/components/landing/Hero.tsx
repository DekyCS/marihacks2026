"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReveal } from './Primitives';

function RulerMarks() {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      viewBox="0 0 400 400"
      preserveAspectRatio="none"
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <line
          key={'t' + i}
          x1={i * 20}
          y1={0}
          x2={i * 20}
          y2={i % 5 === 0 ? 14 : 7}
          stroke="var(--rule-strong)"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: 20 }).map((_, i) => (
        <line
          key={'l' + i}
          x1={0}
          y1={i * 20}
          x2={i % 5 === 0 ? 14 : 7}
          y2={i * 20}
          stroke="var(--rule-strong)"
          strokeWidth={1}
        />
      ))}
      <circle cx={200} cy={200} r={2} fill="var(--ink)" />
      <line x1={180} y1={200} x2={220} y2={200} stroke="var(--ink)" strokeWidth={0.6} opacity={0.6} />
      <line x1={200} y1={180} x2={200} y2={220} stroke="var(--ink)" strokeWidth={0.6} opacity={0.6} />
    </svg>
  );
}

function Bracket({ rotX, rotY }: { rotX: number; rotY: number }) {
  const size = 220;
  const depth = 60;

  const face = (transform: string, bg: string, label: string, stripes = true) => (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform,
        background: bg,
        border: '1.5px solid var(--ink)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--ink-soft)',
        letterSpacing: '.08em',
      }}
    >
      {stripes && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `repeating-linear-gradient(45deg, var(--rule) 0 1px, transparent 1px 9px)`,
          }}
        />
      )}
      <span
        style={{
          background: 'var(--paper)',
          padding: '2px 6px',
          borderRadius: 3,
          zIndex: 1,
        }}
      >
        {label}
      </span>
    </div>
  );

  return (
    <div
      style={{
        width: size,
        height: size,
        transformStyle: 'preserve-3d',
        transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        transition: 'transform .05s linear',
      }}
    >
      {face(`translateZ(${depth / 2}px)`, 'var(--paper-2)', 'FRONT')}
      {face(`rotateY(180deg) translateZ(${depth / 2}px)`, 'var(--paper-2)', 'BACK')}
      {face(`rotateY(90deg) translateZ(${depth / 2}px) scaleX(${depth / size})`, 'var(--paper-2)', '')}
      {face(`rotateY(-90deg) translateZ(${depth / 2}px) scaleX(${depth / size})`, 'var(--paper-2)', '')}
      {face(`rotateX(90deg) translateZ(${depth / 2}px) scaleY(${depth / size})`, 'var(--paper-2)', '')}
      {face(`rotateX(-90deg) translateZ(${depth / 2}px) scaleY(${depth / size})`, 'var(--paper-2)', '')}

      <div
        style={{
          position: 'absolute',
          top: -28,
          left: 30,
          width: 36,
          height: 36,
          border: '1.5px solid var(--ink)',
          borderRadius: '50%',
          background: 'var(--paper)',
          transform: `translateZ(${depth / 2 - 1}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            border: '1.5px solid var(--ink)',
            borderRadius: '50%',
            background: 'var(--pop-soft)',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          top: -28,
          right: 30,
          width: 36,
          height: 36,
          border: '1.5px solid var(--ink)',
          borderRadius: '50%',
          background: 'var(--paper)',
          transform: `translateZ(${depth / 2 - 1}px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            border: '1.5px solid var(--ink)',
            borderRadius: '50%',
            background: 'var(--pop-soft)',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          top: 0,
          right: -120,
          width: 110,
          transform: `translateZ(${depth / 2}px)`,
          pointerEvents: 'none',
        }}
      >
        <div style={{ height: 1, background: 'var(--ink)', width: 60, marginTop: 18 }} />
        <div className="mono" style={{ marginTop: 6, fontSize: 10, color: 'var(--ink)' }}>
          M-112
          <br />
          <span style={{ color: 'var(--ink-mute)' }}>steel bracket</span>
        </div>
      </div>
    </div>
  );
}

function HeroPiece() {
  const [rotY, setRotY] = useState(22);
  const [rotX, setRotX] = useState(-18);
  const [auto, setAuto] = useState(true);
  const draggingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let raf: number;
    const tick = () => {
      if (auto) setRotY((r) => r + 0.35);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto]);

  type PointerEv = React.MouseEvent | React.TouchEvent;
  const getPoint = (e: PointerEv) => {
    if ('touches' in e) return e.touches[0];
    return e as React.MouseEvent;
  };

  const onDown = (e: PointerEv) => {
    draggingRef.current = true;
    setAuto(false);
    const p = getPoint(e);
    lastRef.current = { x: p.clientX, y: p.clientY };
  };
  const onMove = (e: PointerEv) => {
    if (!draggingRef.current) return;
    const p = getPoint(e);
    const dx = p.clientX - lastRef.current.x;
    const dy = p.clientY - lastRef.current.y;
    lastRef.current = { x: p.clientX, y: p.clientY };
    setRotY((r) => r + dx * 0.6);
    setRotX((r) => Math.max(-55, Math.min(10, r - dy * 0.35)));
  };
  const onUp = () => {
    draggingRef.current = false;
    setTimeout(() => setAuto(true), 2000);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-mute)',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        <span>FIG. 01 / BRACKET, 3D</span>
        <span>DRAG TO ROTATE ↔</span>
      </div>

      <div
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          border: '1px solid var(--rule-strong)',
          borderRadius: 16,
          background:
            'radial-gradient(circle at 40% 35%, color-mix(in oklab, var(--pop) 9%, transparent) 0%, transparent 60%), var(--paper-2)',
          cursor: draggingRef.current ? 'grabbing' : 'grab',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <RulerMarks />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: '1200px',
          }}
        >
          <Bracket rotX={rotX} rotY={rotY} />
        </div>

        <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 6 }}>
          <span
            className="mono"
            style={{
              background: 'var(--ink)',
              color: 'var(--paper)',
              padding: '4px 8px',
              borderRadius: 4,
            }}
          >
            STEP 03 / 07
          </span>
        </div>
        <div style={{ position: 'absolute', right: 12, top: 12 }}>
          <span
            className="mono"
            style={{
              padding: '4px 8px',
              border: '1px solid var(--rule-strong)',
              borderRadius: 4,
              color: 'var(--ink-soft)',
            }}
          >
            part M-112
          </span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            right: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'end',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-mute)',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
          }}
        >
          <span>rot.y {Math.round(((rotY % 360) + 360) % 360)}°</span>
          <span>rot.x {Math.round(rotX)}°</span>
          <span>zoom 1.00×</span>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const ref = useReveal();
  const router = useRouter();

  return (
    <section id="top" style={{ position: 'relative', overflow: 'hidden' }}>
      <div
        className="grid-bg"
        style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }}
      />
      <div className="noise" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      <div
        className="container-pad"
        style={{
          position: 'relative',
          paddingTop: 60,
          paddingBottom: 'var(--pad-y)',
        }}
      >
        <div
          ref={ref}
          className="reveal"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 1fr',
            gap: 56,
            alignItems: 'center',
            paddingTop: 40,
          }}
        >
          <div>
            <h1 style={{ marginBottom: 28 }}>
              Throw away the{' '}
              <span className="display-italic" style={{ color: 'var(--pop)' }}>
                cryptic
              </span>{' '}
              booklet.
            </h1>

            <p
              style={{
                fontSize: 20,
                lineHeight: 1.45,
                color: 'var(--ink-soft)',
                maxWidth: 520,
                marginBottom: 36,
              }}
            >
              ManualY turns any PDF manual into an interactive 3D guide with voice narration.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/auth/login')}
                className="btn btn-primary"
                style={{ border: 'none', cursor: 'pointer' }}
              >
                Get started →
              </button>
              <a href="#how" className="btn btn-ghost">
                See how it works
              </a>
            </div>
            <div
              className="mono"
              style={{
                color: 'var(--ink-mute)',
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--pop)',
                }}
              />
              No sign-up · works in your browser · takes ~90 seconds
            </div>
          </div>

          <HeroPiece />
        </div>
      </div>
    </section>
  );
}
