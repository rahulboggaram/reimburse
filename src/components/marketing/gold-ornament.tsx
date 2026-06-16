import type { CSSProperties } from "react";

type OrnamentKind = "necklace" | "bangle" | "ring" | "earring" | "chain";

type Props = {
  kind: OrnamentKind;
  className?: string;
  style?: CSSProperties;
};

export function GoldOrnament({ kind, className, style }: Props) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={className}
      style={style}
      aria-hidden
    >
      {kind === "necklace" && (
        <g fill="none" stroke="currentColor" strokeWidth="2.5">
          <path
            d="M12 48 C12 22, 68 22, 68 48"
            strokeLinecap="round"
          />
          <circle cx="40" cy="52" r="6" fill="currentColor" stroke="none" />
          <circle cx="28" cy="38" r="3" fill="currentColor" stroke="none" />
          <circle cx="52" cy="38" r="3" fill="currentColor" stroke="none" />
        </g>
      )}
      {kind === "bangle" && (
        <g fill="none" stroke="currentColor" strokeWidth="3">
          <ellipse cx="40" cy="40" rx="26" ry="22" />
          <ellipse cx="40" cy="40" rx="18" ry="14" opacity="0.35" />
        </g>
      )}
      {kind === "ring" && (
        <g fill="none" stroke="currentColor" strokeWidth="2.5">
          <ellipse cx="40" cy="46" rx="20" ry="16" />
          <path d="M40 30 L44 18 L36 18 Z" fill="currentColor" stroke="none" />
        </g>
      )}
      {kind === "earring" && (
        <g fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="40" cy="18" r="4" fill="currentColor" stroke="none" />
          <path d="M40 22 L40 34" />
          <circle cx="40" cy="48" r="14" />
          <circle cx="40" cy="48" r="8" opacity="0.3" />
        </g>
      )}
      {kind === "chain" && (
        <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M16 40 C16 20, 32 20, 32 32 C32 44, 48 44, 48 32 C48 20, 64 20, 64 40" />
        </g>
      )}
    </svg>
  );
}

export const HERO_ORNAMENTS: {
  kind: OrnamentKind;
  x: string;
  y: string;
  size: string;
  rotate: number;
}[] = [
  { kind: "necklace", x: "8%", y: "18%", size: "5.5rem", rotate: -12 },
  { kind: "bangle", x: "82%", y: "12%", size: "4.5rem", rotate: 18 },
  { kind: "ring", x: "88%", y: "58%", size: "3.5rem", rotate: 24 },
  { kind: "earring", x: "6%", y: "62%", size: "4rem", rotate: -8 },
  { kind: "chain", x: "72%", y: "78%", size: "4rem", rotate: 6 },
  { kind: "bangle", x: "14%", y: "82%", size: "3.25rem", rotate: -20 },
];
