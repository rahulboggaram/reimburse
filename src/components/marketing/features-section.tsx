const FEATURES = [
  {
    title: "Download the app",
    description:
      "Track your loan, view statements, and manage repayments from your phone — anytime, anywhere.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M10 18h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Interest reminders",
    description:
      "Gentle nudges before your interest due date so you never miss a payment or pay a penalty.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Part payment",
    description:
      "Pay down your principal in chunks whenever you have spare cash — reduce interest as you go.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M12 2v20M17 7l-5-5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Part release",
    description:
      "Need some ornaments back? Release a portion of pledged gold while keeping the rest as collateral.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" strokeLinejoin="round" />
        <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function FeaturesSection() {
  return (
    <section className="ym-section ym-features" id="features">
      <div className="ym-container">
        <p className="ym-eyebrow">Why Yellow Metal</p>
        <h2 className="ym-section-title">Everything you need, in one place</h2>
        <p className="ym-section-subtitle">
          From applying to closing — manage your gold loan without visiting a
          branch for every little thing.
        </p>

        <div className="ym-feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="ym-feature-card">
              <div className="ym-feature-icon">{f.icon}</div>
              <h3 className="ym-feature-title">{f.title}</h3>
              <p className="ym-feature-desc">{f.description}</p>
            </article>
          ))}
        </div>

        <div className="ym-cta-banner">
          <div>
            <p className="ym-cta-banner-title">Ready to get started?</p>
            <p className="ym-cta-banner-text">
              Visit your nearest Yellow Metal branch — we&apos;ll walk you through
              every step.
            </p>
          </div>
          <a href="#rates" className="ym-btn ym-btn--primary">
            Check today&apos;s rate
          </a>
        </div>
      </div>
    </section>
  );
}
