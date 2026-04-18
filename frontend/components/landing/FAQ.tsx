"use client";
import React, { useState } from "react";
import { useReveal, SectionLabel } from "./Primitives";

export default function FAQ() {
  const ref = useReveal();
  const [open, setOpen] = useState(0);
  const items = [
    {
      q: "What file types work?",
      a: "Any legible PDF manual. We parse text, images, and diagrams automatically.",
    },
    {
      q: "How accurate are the 3D models?",
      a: "Accurate enough to tell a bracket from a bolt. Guide-fidelity, not CAD-fidelity.",
    },
    {
      q: "Is my manual private?",
      a: "Yes. Your uploads are yours. We don\u2019t train on them and you can delete them anytime.",
    },
    {
      q: "What does \u201cAssembli\u201d mean?",
      a: "Manual + Y. For \u201cyes, finally.\u201d",
    },
  ];

  return (
    <section
      id="faq"
      style={{
        padding: "var(--pad-y) 0",
        borderTop: "1px solid var(--rule-strong)",
      }}
    >
      <div className="container-pad">
        <div
          ref={ref}
          className="reveal"
          style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 56 }}
        >
          <div style={{ position: "sticky", top: 90, alignSelf: "start" }}>
            <SectionLabel num="02">
              frequently asked, honestly answered
            </SectionLabel>
            <h2 style={{ marginTop: 20 }}>
              You have{" "}
              <span className="display-italic" style={{ color: "var(--pop)" }}>
                questions.
              </span>
            </h2>
            <p
              style={{
                color: "var(--ink-soft)",
                fontSize: 16,
                marginTop: 16,
                maxWidth: 360,
              }}
            >
              The short answers.
            </p>
          </div>

          <div>
            {items.map((it, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={i}
                  style={{
                    borderTop: "1px solid var(--rule)",
                    padding: "20px 0",
                  }}
                >
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 18,
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      alignItems: "baseline",
                      textAlign: "left",
                      color: "var(--ink)",
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        color: isOpen ? "var(--pop)" : "var(--ink-mute)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 22,
                        letterSpacing: "-.015em",
                      }}
                    >
                      {it.q}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 18,
                        transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                        transition: "transform .25s ease",
                      }}
                    >
                      +
                    </span>
                  </button>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 18,
                      maxHeight: isOpen ? 200 : 0,
                      overflow: "hidden",
                      transition: "max-height .35s ease, opacity .3s ease",
                      opacity: isOpen ? 1 : 0,
                      marginTop: isOpen ? 10 : 0,
                    }}
                  >
                    <span />
                    <p
                      style={{
                        color: "var(--ink-soft)",
                        fontSize: 16,
                        margin: 0,
                        maxWidth: 620,
                      }}
                    >
                      {it.a}
                    </p>
                    <span />
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid var(--rule)" }} />
          </div>
        </div>
      </div>
    </section>
  );
}
