"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readJson } from "@/lib/api";
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
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-base font-medium text-zinc-900">
          {formatPhoneDisplay(props.currentPhone)}
        </p>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 text-sm font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
          >
            Change mobile number
          </button>
        ) : (
          <button
            type="button"
            onClick={close}
            className="shrink-0 text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
          >
            Cancel
          </button>
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
              <div className="space-y-1.5">
                <Label htmlFor="new-phone">New mobile number</Label>
                <Input
                  id="new-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  value={newPhoneInput}
                  onChange={(e) => setNewPhoneInput(e.target.value)}
                  placeholder="9876543210"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={loading} className="sm:flex-1">
                  {loading ? "Sending…" : "Send OTP"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={loading}
                  className="sm:flex-1"
                >
                  Cancel
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
              <div className="space-y-1.5">
                <Label htmlFor="change-phone-otp">6-digit OTP</Label>
                <Input
                  id="change-phone-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={loading} className="sm:flex-1">
                  {loading ? "Updating…" : "Confirm new number"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFlow}
                  disabled={loading}
                  className="sm:flex-1"
                >
                  Use a different number
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
