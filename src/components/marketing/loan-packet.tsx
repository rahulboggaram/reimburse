type Props = {
  sealed: boolean;
  className?: string;
};

/** Tamper-proof gold loan packet — kraft envelope with branded seal strip. */
export function LoanPacket({ sealed, className }: Props) {
  return (
    <div className={`ym-packet ${sealed ? "ym-packet--sealed" : ""} ${className ?? ""}`}>
      <svg viewBox="0 0 280 360" className="ym-packet-svg" aria-hidden>
        <defs>
          <linearGradient id="kraft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c4a574" />
            <stop offset="50%" stopColor="#b8956a" />
            <stop offset="100%" stopColor="#a67c52" />
          </linearGradient>
          <linearGradient id="goldSeal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5e6a8" />
            <stop offset="40%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#9a7b0a" />
          </linearGradient>
        </defs>

        {/* Body */}
        <rect x="20" y="60" width="240" height="280" rx="6" fill="url(#kraft)" />
        <rect x="20" y="60" width="240" height="280" rx="6" fill="none" stroke="#8b6914" strokeWidth="1.5" opacity="0.4" />

        {/* Security pattern */}
        <g opacity="0.12" stroke="#5c3d1e" strokeWidth="0.8">
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1="30" y1={80 + i * 22} x2="250" y2={80 + i * 22} />
          ))}
        </g>

        {/* Brand strip */}
        <rect x="20" y="130" width="240" height="44" fill="#1a1208" />
        <text x="140" y="158" textAnchor="middle" fill="#d4af37" fontSize="16" fontWeight="700" fontFamily="system-ui">
          YELLOW METAL
        </text>

        {/* Barcode */}
        <g transform="translate(50, 200)">
          {Array.from({ length: 28 }).map((_, i) => (
            <rect
              key={i}
              x={i * 6}
              y="0"
              width={i % 3 === 0 ? 3 : 1.5}
              height="36"
              fill="#2a1810"
            />
          ))}
        </g>

        {/* Contents label */}
        <text x="140" y="270" textAnchor="middle" fill="#3d2814" fontSize="11" fontFamily="system-ui" opacity="0.7">
          GOLD ORNAMENTS — SEALED
        </text>
        <text x="140" y="288" textAnchor="middle" fill="#3d2814" fontSize="9" fontFamily="system-ui" opacity="0.5">
          DO NOT OPEN WITHOUT AUTHORISATION
        </text>

        {/* Flap */}
        <path
          className="ym-packet-flap"
          d="M20 60 L140 20 L260 60 L260 100 L20 100 Z"
          fill="#d4b896"
          stroke="#8b6914"
          strokeWidth="1.5"
          opacity="0.95"
        />

        {/* Wax seal */}
        <g className="ym-packet-wax">
          <circle cx="140" cy="88" r="22" fill="url(#goldSeal)" stroke="#7a5c0a" strokeWidth="1.5" />
          <text x="140" y="93" textAnchor="middle" fill="#3d2814" fontSize="10" fontWeight="700" fontFamily="system-ui">
            YM
          </text>
        </g>
      </svg>
    </div>
  );
}
