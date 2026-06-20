"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingText } from "@/components/ui/loading-dots";
import { Card } from "@/components/ui/card";
import { FloatingInput } from "@/components/ui/floating-field";
import { ReimburseBrand } from "@/components/reimburse-brand";
import { TextLinkButton } from "@/components/text-link";
import { readJson } from "@/lib/api";
import { invalidateClientCache } from "@/lib/client-cache";

const MOCK_OTP = "123456";
const showDemoHints = process.env.NEXT_PUBLIC_OTP_MOCK === "true";

type Step = "email" | "otp";

export function LoginFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [emailInput, setEmailInput] = useState("");
  const [emailNormalized, setEmailNormalized] = useState("");
  const [otpDestination, setOtpDestination] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  async function sendOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await readJson<{
        email: string;
        mock?: boolean;
        mockCode?: string;
        destination?: string;
      }>(response);
      setEmailNormalized(data.email);
      setOtpDestination(data.destination ?? data.email);
      setIsMock(Boolean(data.mock));
      setOtp(data.mock ? MOCK_OTP : "");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailNormalized || emailInput,
          code: otp.trim(),
        }),
      });
      const data = await readJson<{ redirectTo: string }>(response);
      invalidateClientCache();
      router.replace(data.redirectTo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Incorrect or expired code.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <header className="mb-10 flex justify-center">
        <ReimburseBrand />
      </header>

      <Card className="space-y-4">
        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}

        {isMock && step === "otp" ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Demo mode: your OTP is <strong>{MOCK_OTP}</strong>
          </p>
        ) : null}

        {step === "email" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <FloatingInput
              id="email"
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
            <Button
              type="submit"
              className="w-full"
              size="lg"
              aria-busy={loading}
              disabled={loading}
            >
              {loading ? <LoadingText>Sending</LoadingText> : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-zinc-600">
              Code sent to{" "}
              <span className="font-medium text-zinc-900">
                {otpDestination ?? emailInput}
              </span>
            </p>
            <FloatingInput
              id="otp"
              label="6-digit OTP"
              type="text"
              inputMode="numeric"
              autoComplete={isMock ? "off" : "one-time-code"}
              maxLength={6}
              required
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <Button
              type="submit"
              className="w-full"
              size="lg"
              aria-busy={loading}
              disabled={loading}
            >
              {loading ? <LoadingText>Verifying</LoadingText> : "Sign in"}
            </Button>
            <TextLinkButton
              className="w-full shrink"
              onClick={() => {
                setStep("email");
                setOtp("");
                setEmailNormalized("");
                setOtpDestination(null);
                setIsMock(false);
              }}
            >
              Change email
            </TextLinkButton>
          </form>
        )}
      </Card>

      {showDemoHints ? (
        <p className="mt-6 text-center text-xs text-zinc-500">
          Demo OTP is always 123456
        </p>
      ) : null}
    </div>
  );
}
