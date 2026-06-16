"use client";

import { useEffect, useRef, useState } from "react";
import { GoldOrnament, HERO_ORNAMENTS } from "./gold-ornament";
import { LoanPacket } from "./loan-packet";

export function HeroSection() {
  return (
    <section className="ym-hero">
      <div className="ym-hero-ornaments" aria-hidden>
        {HERO_ORNAMENTS.map((o, i) => (
          <GoldOrnament
            key={i}
            kind={o.kind}
            className="ym-ornament ym-ornament--hero"
            style={{
              left: o.x,
              top: o.y,
              width: o.size,
              height: o.size,
              transform: `rotate(${o.rotate}deg)`,
              ["--ornament-i" as string]: i,
            }}
          />
        ))}
      </div>

      <div className="ym-container ym-hero-content">
        <p className="ym-eyebrow">Yellow Metal</p>
        <h1 className="ym-hero-title">
          Gold Loans
          <span className="ym-hero-title-accent">with no hidden charges</span>
        </h1>
        <p className="ym-hero-subtitle">
          Pledge your gold, get money in minutes. Transparent rates, insured
          storage, and UPI disbursement — nothing tucked in the fine print.
        </p>
        <div className="ym-hero-actions">
          <a href="#rates" className="ym-btn ym-btn--primary">
            Check today&apos;s rate
          </a>
          <a href="#features" className="ym-btn ym-btn--ghost">
            See how it works
          </a>
        </div>
      </div>
    </section>
  );
}

export function PacketSealSection() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const node = sceneRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      const total = rect.height - viewport;
      if (total <= 0) return;
      const scrolled = -rect.top;
      const p = Math.min(1, Math.max(0, scrolled / total));
      setProgress(p);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const sealed = progress > 0.82;
  const collect = Math.min(1, progress / 0.75);

  return (
    <section className="ym-packet-scene" ref={sceneRef}>
      <div className="ym-packet-sticky">
        <div className="ym-container ym-packet-stage">
          <div className="ym-packet-copy">
            <p className="ym-eyebrow">Safe custody</p>
            <h2 className="ym-section-title">Your gold, sealed &amp; insured</h2>
            <p className="ym-section-subtitle">
              Ornaments move from your hands into a tamper-proof packet — the
              same secure pouch we use at every branch. Sealed in front of you,
              stored in our vault.
            </p>
          </div>

          <div className="ym-packet-visual">
            {HERO_ORNAMENTS.map((o, i) => {
              const startX = parseFloat(o.x) / 100;
              const startY = parseFloat(o.y) / 100;
              const tx = (0.5 - startX) * collect * 120;
              const ty = (0.45 - startY) * collect * 100;
              const scale = 1 - collect * 0.65;
              const opacity = 1 - collect * 0.9;

              return (
                <GoldOrnament
                  key={i}
                  kind={o.kind}
                  className="ym-ornament ym-ornament--flying"
                  style={{
                    left: o.x,
                    top: o.y,
                    width: o.size,
                    height: o.size,
                    transform: `translate(${tx}%, ${ty}%) rotate(${o.rotate * (1 - collect)}deg) scale(${scale})`,
                    opacity,
                  }}
                />
              );
            })}

            <LoanPacket sealed={sealed} />
          </div>
        </div>
      </div>
    </section>
  );
}
