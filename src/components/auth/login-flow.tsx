"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReimburseBrand } from "@/components/wapas-brand";
import { readJson } from "@/lib/api";

const MOCK_OTP = "123456";

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
      }>(response);
      setPhoneE164(data.phone);
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
          phone: phoneE164 || phoneInput,
          code: otp.trim(),
        }),
      });
      const data = await readJson<{ redirectTo: string }>(response);
      router.push(data.redirectTo);
      router.refresh();
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
      <header className="mb-6">
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
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="9999000001"
                required
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
              />
              <p className="text-xs text-zinc-500">
                10-digit number (admin demo: 9999000001)
              </p>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Sending…" : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="space-y-4">
            <p className="text-sm text-zinc-600">
              Code sent to{" "}
              <span className="font-medium text-zinc-900">{phoneInput}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="otp">6-digit OTP</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete={isMock ? "off" : "one-time-code"}
                placeholder="123456"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Verifying…" : "Sign in"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-zinc-600 underline"
              onClick={() => {
                setStep("phone");
                setOtp("");
                setPhoneE164("");
                setIsMock(false);
              }}
            >
              Change number
            </button>
          </form>
        )}
      </Card>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Demo OTP is always 123456 · Admin 9999000001 · Employee 9999000003
      </p>
    </div>
  );
}
