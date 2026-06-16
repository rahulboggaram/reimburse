"use client";

import { useEffect, useRef, useState } from "react";

export function UpiSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="ym-section ym-upi-section" ref={ref}>
      <div className="ym-container ym-upi-grid">
        <div>
          <p className="ym-eyebrow">Instant disbursement</p>
          <h2 className="ym-section-title">Money straight to your UPI</h2>
          <p className="ym-section-subtitle">
            Once your gold is pledged and verified, the loan amount lands in
            your UPI within minutes. No bank queues, no waiting days for a
            transfer.
          </p>
        </div>

        <div className={`ym-phone ${visible ? "ym-phone--active" : ""}`}>
          <div className="ym-phone-frame">
            <div className="ym-phone-notch" />
            <div className="ym-phone-screen">
              <div className="ym-phone-header">
                <span className="ym-phone-time">10:42</span>
                <span className="ym-phone-battery" />
              </div>

              <div className="ym-upi-app">
                <p className="ym-upi-app-label">UPI</p>
                <div className="ym-upi-notification">
                  <div className="ym-upi-icon">₹</div>
                  <div>
                    <p className="ym-upi-title">Payment received</p>
                    <p className="ym-upi-from">from Yellow Metal</p>
                  </div>
                </div>

                <p className={`ym-upi-amount ${visible ? "ym-upi-amount--show" : ""}`}>
                  + ₹2,45,000
                </p>
                <p className="ym-upi-status">Credited to your account</p>

                <div className={`ym-upi-pulse ${visible ? "ym-upi-pulse--show" : ""}`}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
