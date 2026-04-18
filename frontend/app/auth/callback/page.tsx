"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const idToken = params.get('id_token');

    try {
      if (accessToken || idToken) {
        localStorage.setItem(
          'manualy:session',
          JSON.stringify({ accessToken, idToken, at: Date.now() })
        );
      }
    } catch {}

    router.replace('/upload');
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--paper)',
      }}
    >
      <div className="mono" style={{ color: 'var(--ink-mute)' }}>
        Signing you in…
      </div>
    </div>
  );
}
