"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingText } from "@/components/ui/loading-dots";
import { FloatingInput } from "@/components/ui/floating-field";
import { readJson } from "@/lib/api";
import { maskEmail } from "@/lib/email";
import { TextLinkButton } from "@/components/text-link";

const MOCK_OTP = "123456";

type Step = "idle" | "otp";

export function ChangeEmailSection(props: {
  currentEmail: string | null;
  onEmailChanged: (email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailNormalized, setEmailNormalized] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  function resetFlow() {
    setStep("idle");
    setNewEmailInput("");
    setEmailNormalized("");
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
      const response = await fetch("/api/profile/change-email/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmailInput }),
      });
      const data = await readJson<{
        email: string;
        mock?: boolean;
        mockCode?: string;
        destination?: string;
      }>(response);
      setEmailNormalized(data.email);
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
      const response = await fetch("/api/profile/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailNormalized || newEmailInput,
          code: otp.trim(),
        }),
      });
      const data = await readJson<{ email: string }>(response);
      props.onEmailChanged(data.email);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 text-base font-medium text-zinc-900">
          {props.currentEmail || (
            <span className="font-normal text-zinc-500">Not added yet</span>
          )}
        </p>
        {!open ? (
          <TextLinkButton onClick={() => setOpen(true)} className="shrink-0">
            {props.currentEmail ? "Edit" : "Add"}
          </TextLinkButton>
        ) : null}
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
                id="new-email"
                label="Email address"
                type="email"
                autoComplete="email"
                required
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
              />
              <div className="flex items-center justify-end gap-4">
                <TextLinkButton type="button" onClick={close} disabled={loading}>
                  Cancel
                </TextLinkButton>
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
                  {maskEmail(emailNormalized)}
                </span>
              </p>
              <FloatingInput
                id="change-email-otp"
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
              <div className="flex flex-col items-end gap-3">
                <TextLinkButton
                  type="button"
                  onClick={resetFlow}
                  disabled={loading}
                  className="self-end"
                >
                  Use a different email
                </TextLinkButton>
                <div className="flex items-center gap-4">
                  <TextLinkButton
                    type="button"
                    onClick={close}
                    disabled={loading}
                  >
                    Cancel
                  </TextLinkButton>
                  <Button type="submit" size="sm" disabled={loading}>
                    {loading ? <LoadingText>Saving</LoadingText> : "Save"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
