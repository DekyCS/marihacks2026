"use client";
import React, { useEffect, useState } from "react";
import { useReveal, SectionLabel } from "./Primitives";

function Dot() {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        background: "var(--rule-strong)",
      }}
    />
  );
}

function PanelUpload() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          width: "80%",
          aspectRatio: "3/2",
          border: "2px dashed var(--rule-strong)",
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          position: "relative",
          background: "var(--paper)",
        }}
      >
        <svg
          width={56}
          height={56}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          style={{ color: "var(--ink-soft)" }}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6" />
          <path d="M9 15l3-3 3 3" />
        </svg>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>
          Drop your PDF manual here
        </div>
        <div className="mono" style={{ color: "var(--ink-mute)" }}>
          IKEA_KALLAX.pdf · 2.4MB
        </div>

        <div
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 16,
            height: 3,
            background: "var(--rule)",
            overflow: "hidden",
            borderRadius: 3,
          }}
        >
          <div
            style={{ width: "64%", height: "100%", background: "var(--pop)" }}
          />
        </div>
      </div>
    </div>
  );
}

function PanelReconstruct() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gap: 14,
        padding: 24,
      }}
    >
      {["M-101", "M-112", "B-200", "W-002", "S-301", "P-017"].map((p, i) => (
        <div
          key={p}
          style={{
            border: "1px solid var(--rule)",
            borderRadius: 10,
            background: "var(--paper)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            position: "relative",
            overflow: "hidden",
            animation: `float-y ${3 + i * 0.2}s ease-in-out infinite`,
          }}
        >
          <svg
            width={52}
            height={52}
            viewBox="0 0 52 52"
            style={{ color: "var(--ink)" }}
          >
            <g transform="translate(26 26)">
              <polygon
                points={
                  i % 2
                    ? "-16,-10 16,-10 16,10 -16,10"
                    : "-14,-14 14,0 14,14 -14,14 -14,-14"
                }
                fill="var(--paper-2)"
                stroke="currentColor"
                strokeWidth={1.4}
              />
              <circle r={3} fill="var(--pop)" />
            </g>
          </svg>
          <span className="mono" style={{ color: "var(--ink-mute)" }}>
            {p}
          </span>
        </div>
      ))}
    </div>
  );
}

function VoiceBars() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "end",
        gap: 3,
        marginTop: 10,
        height: 18,
      }}
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 3,
            background: "var(--ink)",
            height: "100%",
            transformOrigin: "bottom",
            animation: `wave 1.1s ease-in-out ${i * 0.06}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function PanelGuide() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: 18,
        padding: 20,
      }}
    >
      <div
        style={{
          border: "1px solid var(--rule)",
          borderRadius: 10,
          background: "var(--paper)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              border: "1.5px solid var(--ink)",
              borderRadius: 8,
              transform: "rotateX(-22deg) rotateY(32deg)",
              background:
                "repeating-linear-gradient(45deg,var(--rule) 0 1px,transparent 1px 8px)",
            }}
          />
        </div>
        <div
          className="mono"
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            color: "var(--ink-mute)",
          }}
        >
          VIEWPORT
        </div>
        <div
          className="mono"
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            color: "var(--pop)",
          }}
        >
          STEP 3 / 7
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            border: "1px solid var(--rule)",
            borderRadius: 10,
            padding: 14,
            background: "var(--paper)",
          }}
        >
          <div
            className="mono"
            style={{ color: "var(--pop)", marginBottom: 6 }}
          >
            ◉ NARRATOR
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            &ldquo;Take the M-112 bracket and align it with the two pre-drilled
            holes on the side panel.&rdquo;
          </div>
          <VoiceBars />
        </div>
        <div
          style={{
            border: "1px solid var(--rule)",
            borderRadius: 10,
            padding: 14,
            background: "var(--paper-2)",
          }}
        >
          <div
            className="mono"
            style={{ color: "var(--ink-mute)", marginBottom: 6 }}
          >
            YOU, OUT LOUD
          </div>
          <div
            style={{ fontSize: 13, color: "var(--ink)" }}
            className="serif-ital"
          >
            &ldquo;Which screws? The long ones or the black ones?&rdquo;
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPreview({ active }: { active: number }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 90,
        border: "1px solid var(--rule-strong)",
        borderRadius: 18,
        overflow: "hidden",
        background: "var(--paper-2)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--rule)",
          background: "var(--paper)",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <Dot />
          <Dot />
          <Dot />
        </div>
        <span className="mono" style={{ color: "var(--ink-mute)" }}>
          Assembli.app / demo / step {active + 1}
        </span>
        <span className="mono" style={{ color: "var(--pop)" }}>
          ● REC
        </span>
      </div>

      <div
        style={{
          position: "relative",
          aspectRatio: "16/10",
          overflow: "hidden",
        }}
      >
        {active === 0 && <PanelUpload />}
        {active === 1 && <PanelReconstruct />}
        {active === 2 && <PanelGuide />}
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const ref = useReveal();
  const steps = [
    {
      n: "01",
      k: "Drop your PDF",
      v: "Any manual. IKEA, a drone, a crib.",
      side: "UPLOAD",
    },
    {
      n: "02",
      k: "Rebuilt in 3D",
      v: "Every part detected and reconstructed as an interactive 3D model.",
      side: "RECONSTRUCT",
    },
    {
      n: "03",
      k: "Voice walks you through it",
      v: "A narrator guides each step. Ask questions out loud, get answers back.",
      side: "GUIDE",
    },
  ];

  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setActive((a) => (a + 1) % steps.length),
      3800,
    );
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <section
      id="how"
      style={{
        padding: "var(--pad-y) 0",
        borderTop: "1px solid var(--rule-strong)",
      }}
    >
      <div className="container-pad">
        <div ref={ref} className="reveal" style={{ marginBottom: 56 }}>
          <SectionLabel num="01"> how it works </SectionLabel>
          <h2 style={{ marginTop: 20, maxWidth: 900 }}>
            From PDF to{" "}
            <span className="display-italic" style={{ color: "var(--pop)" }}>
              tap-to-rotate
            </span>{" "}
            in three minutes.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.1fr",
            gap: 64,
            alignItems: "start",
          }}
        >
          <div>
            {steps.map((s, i) => (
              <button
                key={s.n}
                onClick={() => setActive(i)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "28px 0",
                  borderTop: "1px solid var(--rule)",
                  borderLeft: "none",
                  borderRight: "none",
                  borderBottom: "none",
                  background: "transparent",
                  cursor: "pointer",
                  opacity: active === i ? 1 : 0.55,
                  transition: "opacity .3s ease",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "baseline", gap: 18 }}
                >
                  <span
                    className="mono"
                    style={{
                      color: active === i ? "var(--pop)" : "var(--ink-mute)",
                    }}
                  >
                    {s.n}
                  </span>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ marginBottom: 8 }}>{s.k}</h3>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--ink-soft)",
                        fontSize: 16,
                        maxWidth: 460,
                      }}
                    >
                      {s.v}
                    </p>
                  </div>
                  <span className="mono" style={{ color: "var(--ink-mute)" }}>
                    {s.side}
                  </span>
                </div>
                <div
                  style={{
                    height: 2,
                    background: "var(--rule)",
                    marginTop: 18,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "var(--pop)",
                      width: active === i ? "100%" : "0%",
                      transition: active === i ? "width 3.8s linear" : "none",
                    }}
                  />
                </div>
              </button>
            ))}
          </div>

          <StepPreview active={active} />
        </div>
      </div>
    </section>
  );
}
