import type { Metadata } from "next";
import { brandFont } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reimburse",
  description: "Submit and approve expense reimbursements",
  applicationName: "Reimburse",
  themeColor: "#d97706",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${brandFont.variable}`}
    >
      <body className="min-h-dvh bg-zinc-100 font-sans text-zinc-900">
        {props.children}
      </body>
    </html>
  );
}
