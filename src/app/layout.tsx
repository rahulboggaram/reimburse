import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wapas",
  description: "Submit and approve expense reimbursements",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh bg-zinc-100 font-sans text-zinc-900">
        {props.children}
      </body>
    </html>
  );
}
