"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readJson } from "@/lib/api";
import { RoleBadge } from "@/components/role-badge";
import { toTitleCase } from "@/lib/user-profile";

export function EmployeeProfileForm(props: {
  title: string;
  description?: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [accessRole, setAccessRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => readJson<{
        name: string | null;
        ifscCode: string | null;
        bankAccountNumber: string | null;
        accessRole: string;
      }>(res))
      .then((data) => {
        setName(data.name ? toTitleCase(data.name) : "");
        setBankAccountNumber(data.bankAccountNumber ?? "");
        setIfscCode(data.ifscCode ?? "");
        setAccessRole(data.accessRole);
      })
      .catch(() => setError("Could not load your profile."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: toTitleCase(name.trim()),
          bankAccountNumber: bankAccountNumber.replace(/\D/g, ""),
          ifscCode: ifscCode.toUpperCase(),
        }),
      });
      const data = await readJson<{ redirectTo: string }>(response);
      router.push(data.redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{toTitleCase(props.title)}</h1>
        {props.description ? (
          <p className="mt-1 text-sm text-zinc-600">{props.description}</p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="space-y-1.5">
        <p className="text-sm font-semibold text-zinc-800">Name</p>
        <div className="space-y-1.5">
          <Label htmlFor="full-name">Full name</Label>
          <Input
            id="full-name"
            required
            value={name}
            onChange={(e) => setName(toTitleCase(e.target.value))}
            placeholder="Ananya Patel"
            autoComplete="name"
          />
        </div>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-semibold text-zinc-800">Role</p>
        <RoleBadge role={accessRole || "Employee"} />
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-semibold text-zinc-800">Bank Account Details</p>

        <div className="space-y-1.5">
          <Label htmlFor="account">Bank account number</Label>
          <Input
            id="account"
            required
            inputMode="numeric"
            value={bankAccountNumber}
            onChange={(e) =>
              setBankAccountNumber(e.target.value.replace(/\D/g, ""))
            }
            placeholder="50100123456789"
            autoComplete="off"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ifsc">IFSC code</Label>
          <Input
            id="ifsc"
            required
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
            placeholder="HDFC0001234"
            maxLength={11}
            autoComplete="off"
          />
        </div>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={saving}>
        {saving
          ? props.submitLabel === "Continue"
            ? "Continuing…"
            : "Saving…"
          : props.submitLabel}
      </Button>
    </form>
  );
}
