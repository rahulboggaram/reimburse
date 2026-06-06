"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingText } from "@/components/ui/loading-dots";
import { FloatingInput } from "@/components/ui/floating-field";
import { readJson } from "@/lib/api";
import { TextLinkButton } from "@/components/text-link";
import { formatPhoneDisplay } from "@/lib/phone";

const MOCK_OTP = "123456";

type Step = "idle" | "otp";

export function ChangePhoneSection(props: {
  currentPhone: string;
  onPhoneChanged: (phone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [newPhoneInput, setNewPhoneInput] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  function resetFlow() {
    setStep("idle");
    setNewPhoneInput("");
    setPhoneE164("");
    setOtp("");
    setError(null);
    setIsMock(false);
  }

  function close() {
    setOpen(false);
    resetFlow();
  }

  async function sendOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/profile/change-phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: newPhoneInput }),
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

  async function confirmChange(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/profile/change-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneE164 || newPhoneInput,
          code: otp.trim(),
        }),
      });
      const data = await readJson<{ phone: string }>(response);
      props.onPhoneChanged(data.phone);
      close();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update mobile number.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 text-base font-medium text-zinc-900">
          {formatPhoneDisplay(props.currentPhone)}
        </p>
        {!open ? (
          <TextLinkButton onClick={() => setOpen(true)} className="shrink-0">
            Change mobile number
          </TextLinkButton>
        ) : (
          <TextLinkButton onClick={close} className="shrink-0">
            Cancel
          </TextLinkButton>
        )}
      </div>

      {open ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          {isMock && step === "otp" ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Demo mode: your OTP is <strong>{MOCK_OTP}</strong>
            </p>
          ) : null}

          {step === "idle" ? (
            <form onSubmit={sendOtp} className="space-y-3">
              <FloatingInput
                id="new-phone"
                label="New mobile number"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                required
                value={newPhoneInput}
                onChange={(e) => setNewPhoneInput(e.target.value)}
              />
              <div className="flex items-center justify-end gap-4">
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? <LoadingText>Sending</LoadingText> : "Send OTP"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={confirmChange} className="space-y-3">
              <p className="text-sm text-zinc-600">
                Code sent to{" "}
                <span className="font-medium text-zinc-900">
                  {formatPhoneDisplay(phoneE164)}
                </span>
              </p>
              <FloatingInput
                id="change-phone-otp"
                label="6-digit OTP"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <div className="flex items-center justify-end gap-4">
                <TextLinkButton
                  type="button"
                  onClick={resetFlow}
                  disabled={loading}
                >
                  Use a different number
                </TextLinkButton>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? <LoadingText>Updating</LoadingText> : "Confirm new number"}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
