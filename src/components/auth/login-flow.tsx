"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

type Step = "phone" | "otp";

export function LoginFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [otpChannel, setOtpChannel] = useState<"whatsapp" | "sms" | null>(
    null,
  );

  useEffect(() => {
    if (step !== "otp" || isMock) return;
    if (!("OTPCredential" in window)) return;

    const controller = new AbortController();
    navigator.credentials
      .get({
        otp: { transport: ["sms"] },
        signal: controller.signal,
      } as CredentialRequestOptions)
      .then((credential) => {
        if (credential && "code" in credential) {
          const code = (credential as { code: string }).code;
          setOtp(code.replace(/\D/g, "").slice(0, 6));
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [step, isMock]);

  async function sendOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const data = await readJson<{
        phone: string;
        mock?: boolean;
        mockCode?: string;
        channel?: "whatsapp" | "sms";
      }>(response);
      setPhoneE164(data.phone);
      setIsMock(Boolean(data.mock));
      setOtpChannel(data.mock ? null : (data.channel ?? "sms"));
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
          phone: phoneE164 || phoneInput,
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

        {step === "phone" ? (
          <form onSubmit={sendOtp} className="space-y-4">
            <FloatingInput
              id="phone"
              label="Mobile number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
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
              {otpChannel === "whatsapp"
                ? "Code sent on WhatsApp to "
                : "Code sent to "}
              <span className="font-medium text-zinc-900">{phoneInput}</span>
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
                setStep("phone");
                setOtp("");
                setPhoneE164("");
                setIsMock(false);
                setOtpChannel(null);
              }}
            >
              Change number
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
