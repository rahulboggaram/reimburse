import { Bricolage_Grotesque } from "next/font/google";

/** Logo wordmark — body text uses Google Sans via google-sans-font.css */
export const brandFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-brand-family",
  display: "swap",
});
