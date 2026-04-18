"use client";
import React, { useEffect, useRef } from 'react';

export function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const fallback = setTimeout(() => el.classList.add('in'), 150);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('in');
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -5% 0px' }
    );
    io.observe(el);
    return () => {
      clearTimeout(fallback);
      io.disconnect();
    };
  }, []);
  return ref;
}

export function SectionLabel({
  num,
  children,
  style,
}: {
  num: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="section-label" style={style}>
      <span className="num">{num}</span>
      <span style={{ width: 32, height: 1, background: 'var(--ink)' }} />
      <span>{children}</span>
    </div>
  );
}
