"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/api";

type RazorpayStatus = {
  configured: boolean;
  mock: boolean;
  mode: string;
};

export function RazorpayXStatusBanner() {
  const [status, setStatus] = useState<RazorpayStatus | null>(null);

  useEffect(() => {
    fetch("/api/admin/razorpayx/status")
      .then((res) => readJson<RazorpayStatus>(res))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  if (status.mock) {
    return (
      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <span className="font-medium">Demo payouts.</span> Claims will not appear
        in your RazorpayX dashboard until you turn off demo mode on Vercel (
        <code className="text-xs">RAZORPAYX_MOCK=false</code>) and add your test
        API keys.
      </p>
    );
  }

  if (!status.configured) {
    return (
      <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <span className="font-medium">RazorpayX not connected.</span> Add your
        test keys in Vercel environment variables, then redeploy.
      </p>
    );
  }

  return (
    <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
      <span className="font-medium">RazorpayX connected</span> ({status.mode}).
      Payouts show in RazorpayX only after you tap{" "}
      <span className="font-medium">Pay via RazorpayX</span> on an approved claim.
    </p>
  );
}
