"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";

type SetupStatus = {
  ready: boolean;
  channel: string | null;
  config: {
    mockMode: boolean;
    configured: boolean;
    hasToken: boolean;
    hasPhoneNumberId: boolean;
    templateName: string | null;
    languageCode: string;
    apiVersion: string;
  };
  sender: {
    ok: boolean;
    displayPhoneNumber?: string;
    status?: string;
    codeVerificationStatus?: string;
    error?: string;
  } | null;
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
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  function loadStatus() {
    setLoading(true);
    fetch("/api/admin/otp-setup")
      .then((r) => readJson<SetupStatus>(r))
      .then(setStatus)
      .catch(() => setError("Could not load WhatsApp setup status."))
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
        body: JSON.stringify({ phone: testPhone }),
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
        title="WhatsApp login (Meta)"
        description="Connect live OTP for reimburse-jade.vercel.app"
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
                ? "Ready — live WhatsApp OTP should work on login."
                : "Not ready yet — finish the steps below."}
            </p>
            <ul className="mt-4 space-y-3">
              <StatusRow
                ok={!status.config.mockMode}
                label="Demo OTP turned off"
                detail={
                  status.config.mockMode
                    ? "Set OTP_MOCK=false and NEXT_PUBLIC_OTP_MOCK=false on Vercel, then redeploy."
                    : "Vercel is set for live OTP."
                }
              />
              <StatusRow
                ok={status.config.configured}
                label="WhatsApp env vars present"
                detail={
                  status.config.configured
                    ? `Template: ${status.config.templateName} · language: ${status.config.languageCode}`
                    : "Add token, phone number ID, and template name on Vercel."
                }
              />
              <StatusRow
                ok={status.sender?.ok === true}
                label="Meta accepts your sender number"
                detail={
                  status.sender?.ok
                    ? [
                        status.sender.displayPhoneNumber,
                        status.sender.status,
                        status.sender.codeVerificationStatus,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : status.sender?.error ?? "Probe not run or failed."
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
              Send test OTP (after Vercel has WhatsApp vars)
            </h2>
            <p className="text-sm text-zinc-600">
              Works even while demo OTP is on. Use your own mobile; if the Meta app
              is still In development, add that number under API Setup → To first.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="min-w-[12rem] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
              <Button
                type="button"
                disabled={testSending || testPhone.replace(/\D/g, "").length < 10}
                onClick={() => void sendTestOtp()}
              >
                {testSending ? "Sending…" : "Send test on WhatsApp"}
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
            <h2 className="font-semibold text-zinc-900">Open in Meta</h2>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://developers.facebook.com/apps/"
                  className="font-medium text-zinc-900 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Meta Developer apps
                </a>{" "}
                → Reimburse → WhatsApp → API Setup
              </li>
              <li>
                <a
                  href="https://business.facebook.com/settings/system-users"
                  className="font-medium text-zinc-900 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  System users &amp; permanent token
                </a>
              </li>
              <li>
                <a
                  href="https://business.facebook.com/wa/manage/message-templates/"
                  className="font-medium text-zinc-900 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Message templates
                </a>{" "}
                (reimburse_login_otp)
              </li>
            </ul>
          </Card>

          <Card className="space-y-2 p-5 text-sm text-zinc-600">
            <h2 className="font-semibold text-zinc-900">Meta checklist</h2>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Reimburse app → WhatsApp → Configuration → Yellow Metal business
                account linked.
              </li>
              <li>
                API Setup → <strong>From</strong> = Yellow Metal +91 (not US test
                number).
              </li>
              <li>
                If status is Pending, register the number with your 6-digit
                WhatsApp two-step PIN.
              </li>
              <li>
                Use a <strong>system user token</strong> (Business settings) with{" "}
                <code className="text-xs">whatsapp_business_messaging</code>.
              </li>
              <li>
                App in Development? Add each tester phone under API Setup → To.
              </li>
              <li>
                Test login at{" "}
                <a
                  href="https://reimburse-jade.vercel.app/login"
                  className="font-medium text-zinc-900 underline"
                >
                  reimburse-jade.vercel.app/login
                </a>
                .
              </li>
            </ol>
            <p>
              If login fails, the error on the login screen now shows Meta’s
              message (e.g. wrong language code — try{" "}
              <code className="text-xs">en_US</code> instead of{" "}
              <code className="text-xs">en</code>).
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
