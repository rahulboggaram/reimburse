"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChangePhoneSection } from "@/components/change-phone-section";
import { readJson } from "@/lib/api";
import { useMe } from "@/components/me-provider";
import {
  fetchClientCache,
  invalidateClientCache,
} from "@/lib/client-cache";
import { PageHeading } from "@/components/page-heading";
import { TextLinkButton } from "@/components/text-link";
import { RoleBadge } from "@/components/role-badge";
import { toTitleCase } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

type EditingSection = "name" | "bank" | null;

function CardActionLink(props: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return <TextLinkButton onClick={props.onClick}>{props.children}</TextLinkButton>;
}

function ProfileFieldRow(props: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">{props.children}</div>
      {props.action ? <div className="shrink-0">{props.action}</div> : null}
    </div>
  );
}

function ProfileFieldLabel(props: { children: React.ReactNode }) {
  return <p className="text-sm text-zinc-500">{props.children}</p>;
}

function ProfileFieldValue(props: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-0.5 text-base font-medium text-zinc-900",
        props.className,
      )}
    >
      {props.children}
    </p>
  );
}

function ProfileCardBlock(props: { children: React.ReactNode }) {
  return <div className="px-5 py-4">{props.children}</div>;
}

export function EmployeeProfileForm(props: {
  title: string;
  description?: string;
  submitLabel: string;
  variant?: "profile" | "onboarding";
}) {
  const router = useRouter();
  const { refreshMe } = useMe();
  const isOnboarding = props.variant === "onboarding";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [accessRole, setAccessRole] = useState<string>("");

  const [savedName, setSavedName] = useState("");
  const [savedIfscCode, setSavedIfscCode] = useState("");
  const [savedBankAccountNumber, setSavedBankAccountNumber] = useState("");

  const [editingSection, setEditingSection] = useState<EditingSection>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClientCache("profile", async () => {
      const res = await fetch("/api/profile");
      return readJson<{
        name: string | null;
        phone: string;
        ifscCode: string | null;
        bankAccountNumber: string | null;
        accessRole: string;
      }>(res);
    })
      .then((data) => {
        const loadedName = data.name ? toTitleCase(data.name) : "";
        const loadedIfsc = data.ifscCode ?? "";
        const loadedAccount = data.bankAccountNumber ?? "";

        setName(loadedName);
        setPhone(data.phone);
        setIfscCode(loadedIfsc);
        setBankAccountNumber(loadedAccount);
        setAccessRole(data.accessRole);

        setSavedName(loadedName);
        setSavedIfscCode(loadedIfsc);
        setSavedBankAccountNumber(loadedAccount);

        if (isOnboarding) {
          if (!loadedName) setEditingSection("name");
          else if (!loadedAccount || !loadedIfsc) setEditingSection("bank");
        }
      })
      .catch(() => setError("Could not load your profile."))
      .finally(() => setLoading(false));
  }, [isOnboarding]);

  async function saveProfile(options?: { redirect?: boolean }) {
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

      const nextName = toTitleCase(name.trim());
      setSavedName(nextName);
      setName(nextName);
      setSavedIfscCode(ifscCode.toUpperCase());
      setSavedBankAccountNumber(bankAccountNumber.replace(/\D/g, ""));
      setEditingSection(null);

      invalidateClientCache("profile");
      await refreshMe();
      if (options?.redirect !== false && isOnboarding) {
        router.push(data.redirectTo);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleOnboardingSubmit(event: React.FormEvent) {
    event.preventDefault();
    await saveProfile();
  }

  function cancelEdit(section: EditingSection) {
    if (section === "name") setName(savedName);
    if (section === "bank") {
      setIfscCode(savedIfscCode);
      setBankAccountNumber(savedBankAccountNumber);
    }
    setEditingSection(null);
    setError(null);
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-36 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-zinc-200" />
        </div>
        <Card className="divide-y divide-zinc-100 p-0">
          <ProfileCardBlock>
            <div className="h-5 w-32 animate-pulse rounded bg-zinc-200" />
          </ProfileCardBlock>
          <ProfileCardBlock>
            <div className="h-5 w-36 animate-pulse rounded bg-zinc-100" />
          </ProfileCardBlock>
          <ProfileCardBlock>
            <div className="h-6 w-20 animate-pulse rounded-full bg-zinc-100" />
          </ProfileCardBlock>
        </Card>
        <Card className="space-y-3">
          <div className="h-4 w-36 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-48 animate-pulse rounded bg-zinc-100" />
        </Card>
      </div>
    );
  }

  const nameEditing = isOnboarding || editingSection === "name";
  const bankEditing = isOnboarding || editingSection === "bank";

  const profileCardClass = "ring-1 ring-zinc-200/80";

  const content = (
    <div className="space-y-6">
      <PageHeading title={props.title} description={props.description} />

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Card className={cn(profileCardClass, "divide-y divide-zinc-100 p-0")}>
        <ProfileCardBlock>
          {nameEditing ? (
            <div className="space-y-4">
              <Input
                id="full-name"
                required
                value={name}
                onChange={(e) => setName(toTitleCase(e.target.value))}
                placeholder="Ananya Patel"
                autoComplete="name"
                aria-label="Name"
              />
              {!isOnboarding ? (
                <div className="flex items-center justify-end gap-4">
                  <TextLinkButton onClick={() => cancelEdit("name")}>
                    Cancel
                  </TextLinkButton>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => saveProfile({ redirect: false })}
                  >
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <ProfileFieldRow
              action={
                !isOnboarding ? (
                  <CardActionLink onClick={() => setEditingSection("name")}>
                    Edit
                  </CardActionLink>
                ) : undefined
              }
            >
              <ProfileFieldValue className="mt-0">
                {savedName || (
                  <span className="font-normal text-zinc-500">Not added yet</span>
                )}
              </ProfileFieldValue>
            </ProfileFieldRow>
          )}
        </ProfileCardBlock>

        {phone ? (
          <ProfileCardBlock>
            <ChangePhoneSection
              currentPhone={phone}
              onPhoneChanged={(nextPhone) => {
                setPhone(nextPhone);
                invalidateClientCache("profile");
              }}
            />
          </ProfileCardBlock>
        ) : null}

        <ProfileCardBlock>
          <RoleBadge role={accessRole || "Employee"} />
        </ProfileCardBlock>
      </Card>

      <Card className={cn(profileCardClass, "p-5")}>
        {isOnboarding ? (
          <p className="mb-4 text-sm text-zinc-600">
            Bank details are required for every team member so payouts can reach
            the right account.
          </p>
        ) : null}
        {bankEditing ? (
          <div className="space-y-4">
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
            {!isOnboarding ? (
              <div className="flex items-center justify-end gap-4">
                <TextLinkButton onClick={() => cancelEdit("bank")}>
                  Cancel
                </TextLinkButton>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => saveProfile({ redirect: false })}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-6">
              <div>
                <ProfileFieldLabel>Account number</ProfileFieldLabel>
                <ProfileFieldValue className="break-all font-tabular-nums">
                  {savedBankAccountNumber || (
                    <span className="font-normal text-zinc-500">Not added yet</span>
                  )}
                </ProfileFieldValue>
              </div>
              <div>
                <ProfileFieldLabel>IFSC code</ProfileFieldLabel>
                <ProfileFieldValue className="break-all font-tabular-nums uppercase">
                  {savedIfscCode || (
                    <span className="font-normal text-zinc-500 normal-case">
                      Not added yet
                    </span>
                  )}
                </ProfileFieldValue>
              </div>
            </div>
            {!isOnboarding ? (
              <CardActionLink onClick={() => setEditingSection("bank")}>
                Edit
              </CardActionLink>
            ) : null}
          </div>
        )}
      </Card>

      {isOnboarding ? (
        <Button type="submit" size="lg" className="w-full" disabled={saving}>
          {saving ? "Continuing…" : props.submitLabel}
        </Button>
      ) : null}
    </div>
  );

  if (isOnboarding) {
    return <form onSubmit={handleOnboardingSubmit}>{content}</form>;
  }

  return content;
}
