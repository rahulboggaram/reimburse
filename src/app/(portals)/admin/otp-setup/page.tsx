"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/floating-field";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";

type SetupStatus = {
  ready: boolean;
  mockMode: boolean;
  email: {
    configured: boolean;
    from: string | null;
  };
  vercelVars: Record<string, string>;
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

export default function AdminOtpSetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  function loadStatus() {
    setLoading(true);
    fetch("/api/admin/otp-setup")
      .then((r) => readJson<SetupStatus>(r))
      .then(setStatus)
      .catch(() => setError("Could not load OTP setup status."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function sendTestOtp() {
    setTestSending(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/otp-setup/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok) {
        setTestResult(data.error ?? "Test send failed.");
      } else {
        setTestResult(data.message ?? "Sent.");
      }
      loadStatus();
    } catch {
      setTestResult("Could not reach the server.");
    } finally {
      setTestSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Login OTP"
        description="Email OTP via Postmark for reimburse-jade.vercel.app"
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
                ? "Ready — live email OTP should work on login."
                : "Not ready yet — finish the steps below."}
            </p>
            <ul className="mt-4 space-y-3">
              <StatusRow
                ok={!status.mockMode}
                label="Demo OTP turned off"
                detail={
                  status.mockMode
                    ? "Set OTP_MOCK=false and NEXT_PUBLIC_OTP_MOCK=false on Vercel, then redeploy."
                    : "Vercel is set for live OTP."
                }
              />
              <StatusRow
                ok={status.email.configured}
                label="Postmark email OTP"
                detail={
                  status.email.configured
                    ? `From: ${status.email.from}`
                    : "Add POSTMARK_SERVER_TOKEN and OTP_EMAIL_FROM on Vercel. Each person also needs an email in People."
                }
              />
            </ul>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Vercel → Production variables
            </h2>
            <p className="text-sm text-zinc-600">
              Paste these in{" "}
              <a
                href="https://vercel.com"
                className="font-medium text-zinc-900 underline"
                target="_blank"
                rel="noreferrer"
              >
                Vercel
              </a>{" "}
              for the Reimburse project, then <strong>Redeploy</strong>.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800">
              {Object.entries(status.vercelVars)
                .map(([key, value]) => `${key}=${value}`)
                .join("\n")}
            </pre>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-zinc-900">
              Send test OTP
            </h2>
            <p className="text-sm text-zinc-600">
              Works even while demo OTP is on. Use any inbox you can check.
            </p>
            <div className="flex flex-wrap gap-2">
              <FloatingInput
                type="email"
                label="Email address"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="min-w-[12rem] flex-1"
              />
              <Button
                type="button"
                disabled={testSending || !testEmail.includes("@")}
                onClick={() => void sendTestOtp()}
              >
                {testSending ? "Sending…" : "Send test email"}
              </Button>
            </div>
            {testResult ? (
              <p
                className={
                  testResult.includes("sent")
                    ? "text-sm text-emerald-800"
                    : "text-sm text-red-700"
                }
                role="status"
              >
                {testResult}
              </p>
            ) : null}
          </Card>

          <Card className="space-y-2 p-5 text-sm text-zinc-600">
            <h2 className="font-semibold text-zinc-900">Postmark setup</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Create a server at{" "}
                <a
                  href="https://postmarkapp.com"
                  className="font-medium text-zinc-900 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  postmarkapp.com
                </a>
                .
              </li>
              <li>Verify your sending domain (e.g. reimburse.yellowmetal.co).</li>
              <li>
                Copy the <strong>Server API token</strong> →{" "}
                <code className="text-xs">POSTMARK_SERVER_TOKEN</code> on Vercel.
              </li>
              <li>
                Set <code className="text-xs">OTP_EMAIL_FROM</code> to a verified
                sender, e.g.{" "}
                <code className="text-xs">Reimburse &lt;otp@reimburse.yellowmetal.co&gt;</code>.
              </li>
              <li>
                Add each employee&apos;s email in Admin → People — login codes go
                to that address.
              </li>
            </ol>
          </Card>
        </>
      ) : null}
    </div>
  );
}
