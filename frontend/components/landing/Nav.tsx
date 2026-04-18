"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function Logo() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x={3} y={3} width={18} height={18} rx={3} stroke="currentColor" strokeWidth={1.6} />
      <path d="M3 9 L21 9" stroke="currentColor" strokeWidth={1.6} />
      <circle cx={7} cy={6} r={0.9} fill="currentColor" />
      <path d="M8 14 L16 14 M8 17 L13 17" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

export default function Nav() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: scrolled ? 'color-mix(in oklab, var(--paper) 88%, transparent)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px) saturate(140%)' : 'none',
        borderBottom: scrolled ? '1px solid var(--rule)' : '1px solid transparent',
        transition: 'all .25s ease',
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
        <a
          href="#top"
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
        >
          <Logo />
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
        </a>

        <nav style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {[
            { label: 'How it works', href: '#how' },
            { label: 'FAQ', href: '#faq' },
          ].map((t) => (
            <a
              key={t.label}
              href={t.href}
              style={{ textDecoration: 'none', fontSize: 14, color: 'var(--ink-soft)' }}
            >
              {t.label}
            </a>
          ))}
          <button
            onClick={() => router.push('/auth/login')}
            className="btn btn-primary"
            style={{ padding: '9px 16px', fontSize: 13, border: 'none', cursor: 'pointer' }}
          >
            Get started →
          </button>
        </nav>
      </div>
    </header>
  );
}
