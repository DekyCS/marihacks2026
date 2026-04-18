"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AuthLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
    const auth0ClientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;

    if (auth0Domain && auth0ClientId) {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const url = `https://${auth0Domain}/authorize?response_type=token&client_id=${encodeURIComponent(
        auth0ClientId
      )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile%20email${
        email ? `&login_hint=${encodeURIComponent(email)}` : ''
      }`;
      window.location.href = url;
      return;
    }

    try {
      localStorage.setItem(
        'manualy:session',
        JSON.stringify({ email: email || 'guest@manualy.app', at: Date.now() })
      );
    } catch {}

    await new Promise((r) => setTimeout(r, 650));
    router.push('/upload');
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.5 }} />
      <div className="noise" style={{ position: 'absolute', inset: 0 }} />

      <header style={{ position: 'relative', zIndex: 2 }}>
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
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, letterSpacing: '-.01em' }}>
              ManualY
            </span>
          </Link>
          <Link href="/" style={{ textDecoration: 'none', fontSize: 13, color: 'var(--ink-mute)' }} className="mono">
            ← Back
          </Link>
        </div>
      </header>

      <main
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          placeItems: 'center',
          padding: '60px 24px 120px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            background: 'var(--paper)',
            border: '1px solid var(--rule-strong)',
            borderRadius: 20,
            padding: '36px 32px 28px',
            boxShadow: '0 30px 80px rgba(0,0,0,0.08)',
          }}
        >
          <div className="mono" style={{ color: 'var(--ink-mute)', marginBottom: 10 }}>
            <span style={{ color: 'var(--ink)' }}>N° 01</span> / AUTHENTICATE
          </div>
          <h2 style={{ fontSize: 34, lineHeight: 1.05, marginBottom: 10 }}>
            Sign in to{' '}
            <span className="display-italic" style={{ color: 'var(--pop)' }}>
              ManualY.
            </span>
          </h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.55, margin: 0, marginBottom: 28 }}>
            We use Auth0 to keep your manuals yours. One click to continue.
          </p>

          <form onSubmit={handleContinue} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="mono" style={{ color: 'var(--ink-mute)', marginBottom: 8, display: 'block' }}>
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  border: '1px solid var(--rule-strong)',
                  borderRadius: 14,
                  background: 'var(--paper-2)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                justifyContent: 'center',
                width: '100%',
                border: 'none',
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Redirecting…' : 'Continue with Auth0 →'}
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: 'var(--ink-mute)',
                fontSize: 12,
                marginTop: 4,
              }}
            >
              <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
              <span className="mono">OR</span>
              <span style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
            </div>

            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem('manualy:session', JSON.stringify({ email: 'guest', at: Date.now() }));
                } catch {}
                router.push('/upload');
              }}
              className="btn btn-ghost"
              style={{ justifyContent: 'center', width: '100%' }}
            >
              Continue as guest
            </button>
          </form>

          <p
            className="mono"
            style={{ color: 'var(--ink-mute)', marginTop: 22, fontSize: 10, lineHeight: 1.6, textAlign: 'center' }}
          >
            By continuing you agree to our terms. No spam, ever.
          </p>
        </div>
      </main>
    </div>
  );
}
