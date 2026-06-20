import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/blog", label: "Blog" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms & conditions" },
];

export function SiteHeader() {
  return (
    <header className="ym-header">
      <div className="ym-container ym-header-inner">
        <Link href="/" className="ym-logo">
          <span className="ym-logo-mark">YM</span>
          <span className="ym-logo-text">Yellow Metal</span>
        </Link>
        <nav className="ym-nav">
          <a href="#rates">Rates</a>
          <a href="#features">Features</a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="ym-footer">
      <div className="ym-container ym-footer-inner">
        <div className="ym-footer-brand">
          <p className="ym-logo-text">Yellow Metal</p>
          <p className="ym-footer-tagline">
            Gold loans made simple. No hidden charges, ever.
          </p>
        </div>

        <nav className="ym-footer-nav">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="ym-footer-copy">
          © {new Date().getFullYear()} Yellow Metal. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
