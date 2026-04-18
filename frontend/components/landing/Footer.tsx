"use client";
import React from 'react';
import { useRouter } from 'next/navigation';
import { useReveal } from './Primitives';

export default function Footer() {
  const ref = useReveal();
  const router = useRouter();

  return (
    <footer
      id="cta"
      style={{
        borderTop: '1px solid var(--rule-strong)',
        background: 'var(--paper)',
        color: 'var(--ink)',
        padding: 'var(--pad-y) 0 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="container-pad" style={{ position: 'relative' }}>
        <div ref={ref} className="reveal" style={{ textAlign: 'left', maxWidth: 1000 }}>
          <h2 style={{ fontSize: 'clamp(44px, 7vw, 96px)', lineHeight: 0.98, letterSpacing: '-.035em' }}>
            Scan the box.
            <br />
            <span className="display-italic" style={{ color: 'var(--pop)' }}>
              Never read a manual again.
            </span>
          </h2>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 40 }}>
            <button
              onClick={() => router.push('/upload')}
              className="btn btn-primary"
              style={{ fontSize: 16, padding: '16px 26px', border: 'none', cursor: 'pointer' }}
            >
              Get started →
            </button>
            <a href="#top" className="btn btn-ghost" style={{ fontSize: 16, padding: '16px 26px' }}>
              Back to top
            </a>
          </div>
        </div>

        <div
          style={{
            marginTop: 80,
            paddingTop: 20,
            borderTop: '1px solid var(--rule)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-mute)',
          }}
        >
          <span>© 2026 Assembli</span>
          <span>Built at MariHacks 2026 · Montréal</span>
        </div>
      </div>
    </footer>
  );
}
