"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";

type SetupStatus = {
  ready: boolean;
  mode: "mock" | "test" | "live" | "unconfigured";
  mockEnv: "on" | "off" | "unset" | "invalid";
  config: {
    enabled: boolean;
    mock: boolean;
    keyId: string;
    accountNumber: string;
    payoutMode: string;
    webhookSecret: string | null;
  };
  probe: { ok: boolean; error?: string } | null;
  vercelVars: Record<string, string>;
  webhookUrl: string;
};

function StatusRow(props: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex gap-3 text-sm">
      <span
        className={props.ok ? "text-emerald-700" : "text-amber-700"}
        aria-hidden
      >
        {props.ok ? "✓" : "○"}
      </span>
      <span>
        <span className="font-medium text-zinc-900">{props.label}</span>
        {props.detail ? (
          <span className="mt-0.5 block text-zinc-600">{props.detail}</span>
        ) : null}
      </span>
    </li>
  );
}

function modeLabel(mode: SetupStatus["mode"]) {
  switch (mode) {
    case "mock":
      return "Demo (mock payouts)";
    case "test":
      return "Razorpay test mode";
    case "live":
      return "Razorpay live — real money";
    default:
      return "Not configured";
  }
}

export default function AdminRazorpaySetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/razorpay-setup")
      .then((r) => readJson<SetupStatus>(r))
      .then(setStatus)
      .catch(() => setError("Could not load Razorpay status."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Razorpay payouts"
        description="Pay approved reimbursements to employee bank accounts"
      />

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Checking configuration…</p>
      ) : status ? (
        <>
          <Card className="p-5">
            <p
              className={
                status.ready
                  ? "text-base font-semibold text-emerald-900"
                  : "text-base font-semibold text-amber-900"
              }
            >
              {status.ready
                ? `Ready — ${modeLabel(status.mode)}`
                : "Not ready — add Razorpay keys on Vercel"}
            </p>
            <ul className="mt-4 space-y-3">
              <StatusRow
                ok={status.mode !== "mock" && status.mockEnv !== "on"}
                label="Mock mode off (or real keys present)"
                detail={
                  status.config.mock
                    ? "Demo payouts only — add API keys on Vercel for real RazorpayX."
                    : `RAZORPAYX_MOCK=${status.mockEnv}`
                }
              />
              <StatusRow
                ok={Boolean(status.config.keyId && status.config.accountNumber)}
                label="API keys and account number"
                detail={
                  status.config.keyId
                    ? `Key: ${status.config.keyId.slice(0, 16)}… · Account: ${status.config.accountNumber || "—"}`
                    : "Add RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER"
                }
              />
              <StatusRow
                ok={status.probe?.ok === true}
                label="RazorpayX API connection"
                detail={
                  status.probe?.ok
                    ? "Server can talk to Razorpay."
                    : status.probe?.error ?? "Probe not run."
                }
              />
              <StatusRow
                ok={Boolean(status.config.webhookSecret) || status.config.mock}
                label="Webhook secret (recommended)"
                detail={
                  status.config.webhookSecret
                    ? "Set — payout status updates automatically."
                    : "Optional but recommended for live payouts."
                }
              />
            </ul>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Vercel → Production variables
            </h2>
            <p className="text-sm text-zinc-600">
              Add these in Vercel for the Reimburse project, then{" "}
              <strong>Redeploy</strong>.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800">
              {Object.entries(status.vercelVars)
                .map(([key, value]) => `${key}=${value}`)
                .join("\n")}
            </pre>
          </Card>

          <Card className="space-y-3 p-5 text-sm text-zinc-600">
            <h2 className="font-semibold text-zinc-900">Go live checklist</h2>
            <p>
              Test keys (<code className="text-xs">rzp_test_</code>) use fake
              money. Live keys (<code className="text-xs">rzp_live_</code>) send
              real IMPS transfers to employee bank accounts.
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <a
                  href="https://razorpay.com/x/"
                  className="font-medium text-zinc-900 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  RazorpayX
                </a>{" "}
                → complete <strong>KYC</strong> → add balance to your{" "}
                <strong>live</strong> payout account
              </li>
              <li>
                <strong>Developer Controls</strong> → switch to{" "}
                <strong>Live mode</strong> → generate <strong>Live API keys</strong>
              </li>
              <li>
                <strong>Banking → Customer Identifier</strong> (live account) →
                copy into <code className="text-xs">RAZORPAYX_ACCOUNT_NUMBER</code>
              </li>
              <li>
                Vercel → Reimburse → Settings → Environment Variables → paste
                all variables above → <strong>Redeploy</strong>
              </li>
              <li>
                Razorpay → Webhooks (live) → URL{" "}
                <code className="text-xs break-all">{status.webhookUrl}</code>
                <br />
                Events: payout.processed, payout.failed, payout.queued → copy
                secret to <code className="text-xs">RAZORPAYX_WEBHOOK_SECRET</code>
              </li>
              <li>
                Return here — status should show{" "}
                <strong>Razorpay live — real money</strong> with a green API
                connection check
              </li>
            </ol>
            {status.mode === "test" ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                You are on <strong>test mode</strong> right now. Swap to live
                keys on Vercel to move real money.
              </p>
            ) : null}
            {status.mode === "live" ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                Live mode is active — payouts use real money.
              </p>
            ) : null}
          </Card>

          <Card className="space-y-2 p-5 text-sm text-zinc-600">
            <h2 className="font-semibold text-zinc-900">How to pay a claim</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Employee submits claim with bank details on profile</li>
              <li>Approver approves the claim</li>
              <li>
                Payment approver clicks <strong>Pay</strong> on Approvals, or
                admin pays from All Claims
              </li>
              <li>Money goes to the employee&apos;s bank via IMPS</li>
            </ol>
          </Card>
        </>
      ) : null}
    </div>
  );
}
