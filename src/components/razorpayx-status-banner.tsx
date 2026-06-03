"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/api";

type RecentPayout = {
  claimId: string;
  employeeName: string;
  amount: number;
  payoutId: string | null;
  payoutStatus: string | null;
  payoutError: string | null;
  initiatedAt: string | null;
  isSimulated: boolean;
};

type RazorpayStatus = {
  configured: boolean;
  mock: boolean;
  mockEnv: "on" | "off" | "unset" | "invalid";
  deployment: string;
  hasKeyId: boolean;
  hasKeySecret: boolean;
  hasAccountNumber: boolean;
  mode: string;
  keyEnvironment: "test" | "live" | "unknown";
  missingEnv: string[];
  approvedAwaitingPay: number;
  recentPayouts: RecentPayout[];
};

function RecentPayoutsList(props: {
  payouts: RecentPayout[];
  razorpayConnected?: boolean;
}) {
  if (props.payouts.length === 0) {
    return (
      <p className="mt-2 text-sm">
        No payouts have been sent from Reimburse yet. Open an{" "}
        <span className="font-medium">approved</span> claim and tap{" "}
        <span className="font-medium">Pay via RazorpayX</span>.
      </p>
    );
  }

  return (
    <ul className="mt-2 space-y-1.5 text-sm">
      {props.payouts.map((payout) => (
        <li key={payout.claimId} className="rounded-lg bg-white/70 px-3 py-2">
          <span className="font-medium">{payout.employeeName}</span> · ₹
          {payout.amount.toLocaleString("en-IN")} ·{" "}
          <span className="font-mono text-xs">{payout.payoutId}</span>
          {payout.isSimulated ? (
            <span className="ml-1 text-amber-800">
              {props.razorpayConnected
                ? "(paid earlier in demo — not in Razorpay)"
                : "(demo only — not in Razorpay)"}
            </span>
          ) : (
            <span className="ml-1 text-zinc-600">
              ({payout.payoutStatus ?? "unknown"})
            </span>
          )}
          {payout.payoutError ? (
            <p className="mt-1 text-red-700">{payout.payoutError}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function RazorpayXStatusBanner() {
  const [status, setStatus] = useState<RazorpayStatus | null>(null);

  useEffect(() => {
    fetch("/api/admin/razorpayx/status", { cache: "no-store" })
      .then((res) => readJson<RazorpayStatus>(res))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  if (status.mock) {
    const keyBits = [
      status.hasKeyId ? "Key ID ✓" : "Key ID ✗",
      status.hasKeySecret ? "Secret ✓" : "Secret ✗",
      status.hasAccountNumber ? "Account # ✓" : "Account # ✗",
    ];
    return (
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p>
          <span className="font-medium">Demo mode is on.</span> Payouts are faked
          inside Reimburse and will{" "}
          <span className="font-medium">not</span> appear in RazorpayX.
        </p>
        <p className="mt-2 text-xs text-amber-900/90">
          Server ({status.deployment}): RAZORPAYX_MOCK=
          <span className="font-mono font-medium">{status.mockEnv}</span> ·{" "}
          {keyBits.join(" · ")}
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
          <li>
            Vercel → Settings → Environment Variables → set{" "}
            <code className="text-xs">RAZORPAYX_MOCK</code> to{" "}
            <code className="text-xs">false</code> for{" "}
            <span className="font-medium">Production</span>
          </li>
          <li>
            Add all three: Key ID, Secret, and Customer Identifier (account
            number)
          </li>
          <li>
            <span className="font-medium">Redeploy</span> Production after saving
            (env changes do not apply until redeploy)
          </li>
          <li>Hard-refresh this page (Cmd+Shift+R)</li>
        </ul>
        <p className="mt-2 text-xs text-amber-900/90">
          Older payouts below stay labeled &ldquo;demo only&rdquo; — only new
          payments after setup use Razorpay.
        </p>
        <RecentPayoutsList payouts={status.recentPayouts} />
      </div>
    );
  }

  if (!status.configured || status.missingEnv.length > 0) {
    return (
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <p>
          <span className="font-medium">RazorpayX is not fully connected.</span>{" "}
          Missing on the server: {status.missingEnv.join(", ") || "configuration"}.
        </p>
        <p className="mt-2">
          Add them in Vercel → Settings → Environment Variables, then redeploy.
        </p>
        <RecentPayoutsList payouts={status.recentPayouts} />
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
      <p>
        <span className="font-medium">
          RazorpayX {status.keyEnvironment === "live" ? "live" : "test"} connected
        </span>{" "}
        ({status.mode}).
        {status.approvedAwaitingPay > 0 ? (
          <>
            {" "}
            {status.approvedAwaitingPay} approved claim
            {status.approvedAwaitingPay === 1 ? "" : "s"} still need{" "}
            <span className="font-medium">Pay via RazorpayX</span>.
          </>
        ) : null}
      </p>
      <p className="mt-2">
        In RazorpayX go to <span className="font-medium">My Account &amp; Settings →
        RazorpayX → Payouts</span> (not Payments). Test payouts show a
        &ldquo;Test&rdquo; label.
      </p>
      {status.keyEnvironment === "live" ? (
        <p className="mt-2">
          Live payouts from Vercel need your deployment IP allowlisted in Razorpay
          (Developer Controls → Share IP Addresses), or use Vercel Static IPs.
        </p>
      ) : null}
      {status.recentPayouts.some((p) => p.isSimulated) ? (
        <p className="mt-2 text-xs text-blue-900/90">
          Payouts listed below with{" "}
          <span className="font-medium">pout_mock_</span> were made before Razorpay
          was connected. They stay in Reimburse only. Pay an approved claim now to
          create a real test payout in Razorpay (ID starts with{" "}
          <span className="font-medium">pout_</span>, not{" "}
          <span className="font-medium">pout_mock_</span>).
        </p>
      ) : null}
      <RecentPayoutsList
        payouts={status.recentPayouts}
        razorpayConnected
      />
    </div>
  );
}
