import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import "./marketing.css";

export const metadata: Metadata = {
  title: "Yellow Metal — Gold Loans with no hidden charges",
  description:
    "Get a gold loan from Yellow Metal. Transparent rates, insured storage, UPI disbursement, and no hidden charges.",
  applicationName: "Yellow Metal",
  themeColor: "#d4af37",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="ym-site">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
