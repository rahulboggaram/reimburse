import { Bricolage_Grotesque, Unbounded } from "next/font/google";

/** Logo wordmark — body text uses Google Sans via google-sans-font.css */
export const brandFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-brand-family",
  display: "swap",
});

/** Alternate logo preview (Unbounded) */
export const brandAltFont = Unbounded({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-brand-alt-family",
  display: "swap",
});
