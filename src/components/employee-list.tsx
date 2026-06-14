"use client";

import type { UserRole } from "@prisma/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingText } from "@/components/ui/loading-dots";
import { FloatingInput } from "@/components/ui/floating-field";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { TextLinkButton } from "@/components/text-link";
import { ASSIGNABLE_ROLES, formatRole } from "@/lib/access-roles";
import { userRoleRequiresBranch } from "@/lib/user-branch";
import { formatPhoneDisplay } from "@/lib/phone";
import { listRowInsetDividerClass } from "@/components/claims-table-layout";
import { cn } from "@/lib/utils";

export type EmployeeRecord = {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  ifscCode: string | null;
  bankAccountNumber: string | null;
  role: UserRole;
  branchId: string | null;
  branchName: string | null;
  branchActive: boolean | null;
  active: boolean;
  signedUp: boolean;
  claimCount: number;
};

export function EmployeeListRow(props: {
  employee: EmployeeRecord;
  onOpen: () => void;
}) {
  const { employee } = props;
  const displayName = employee.name ?? "Not signed up yet";

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white sm:px-5",
        listRowInsetDividerClass,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-sm font-medium",
              employee.name ? "text-zinc-900" : "text-zinc-400",
            )}
          >
            {displayName}
          </p>
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-zinc-900">
          {formatPhoneDisplay(employee.phone)}
          {employee.signedUp
            ? ` · ${employee.claimCount} claim${employee.claimCount === 1 ? "" : "s"}`
            : " · Pending signup"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        {employee.branchName ? (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
            {employee.branchName}
          </span>
        ) : null}
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
          {formatRole(employee.role)}
        </span>
      </div>
      <span className="shrink-0 text-lg text-zinc-400" aria-hidden>
        ›
      </span>
    </button>
  );
}

export function EmployeeDetailModal(props: {
  employee: EmployeeRecord | null;
  open: boolean;
  onClose: () => void;
  branches: { id: string; name: string; active: boolean }[];
  onUpdate: (update: {
    id: string;
    role: UserRole;
    branchId: string | null;
    active?: boolean;
    email?: string;
  }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  if (!props.employee) return null;

  const employee = props.employee;
  const [role, setRole] = useState<UserRole>(employee.role);
  const [branchId, setBranchId] = useState<string>(employee.branchId ?? "");
  const [email, setEmail] = useState(employee.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRole(employee.role);
    setBranchId(employee.branchId ?? "");
    setEmail(employee.email ?? "");
    setError(null);
  }, [employee.id, employee.role, employee.branchId, employee.email]);

  const needsBranch = userRoleRequiresBranch(role);

  const isDirty = useMemo(() => {
    const savedBranch = employee.branchId ?? "";
    const savedEmail = employee.email ?? "";
    return (
      role !== employee.role ||
      branchId !== savedBranch ||
      email.trim() !== savedEmail
    );
  }, [role, branchId, email, employee.role, employee.branchId, employee.email]);

  const canSave = isDirty && (!needsBranch || Boolean(branchId));

  async function saveChanges() {
    if (!canSave) return;

    setSaving(true);
    setError(null);
    try {
      await props.onUpdate({
        id: employee.id,
        role,
        branchId: needsBranch ? branchId : null,
        email: email.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={employee.name ?? formatPhoneDisplay(employee.phone)}
    >
      <div className="space-y-4">
        <div className="space-y-1 text-sm">
          <p className="text-zinc-600">{formatPhoneDisplay(employee.phone)}</p>
          {employee.signedUp ? (
            <p className="text-zinc-500">
              {employee.ifscCode} · {employee.bankAccountNumber ?? ""}
            </p>
          ) : (
            <p className="text-amber-700">Waiting for first login & profile</p>
          )}
          <p className="text-zinc-500">
            {employee.claimCount} reimbursement
            {employee.claimCount === 1 ? "" : "s"} submitted
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${employee.id}-email`}>Email for login</Label>
            <FloatingInput
              id={`${employee.id}-email`}
              label="Email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${employee.id}-role`}>Role</Label>
            <Select
              id={`${employee.id}-role`}
              value={role}
              onChange={(e) => {
                const nextRole = e.target.value as UserRole;
                setRole(nextRole);
                if (!userRoleRequiresBranch(nextRole)) {
                  setBranchId("");
                }
              }}
            >
              {ASSIGNABLE_ROLES.map((roleOption) => (
                <option key={roleOption} value={roleOption}>
                  {formatRole(roleOption)}
                </option>
              ))}
            </Select>
          </div>

          {needsBranch ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${employee.id}-branch`}>Branch</Label>
              <Select
                id={`${employee.id}-branch`}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="" disabled>
                  Select branch
                </option>
                {props.branches.map((branch) => (
                  <option key={branch.id} value={branch.id} disabled={!branch.active}>
                    {branch.name}
                    {!branch.active ? " (inactive)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        {!employee.active ? (
          <>
            <p className="text-sm text-zinc-600">
              This person is inactive. Save any updates, then restore access when
              ready.
            </p>
            {needsBranch && !branchId ? (
              <p className="text-sm text-amber-800">
                Select an active branch before restoring.
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={!canSave || saving}
              onClick={() => void saveChanges()}
            >
              {saving ? <LoadingText>Saving</LoadingText> : "Save changes"}
            </Button>
            <Button
              type="button"
              className="w-full"
              disabled={saving || (needsBranch && !branchId)}
              onClick={async () => {
                setSaving(true);
                setError(null);
                try {
                  await props.onUpdate({
                    id: employee.id,
                    role,
                    branchId: needsBranch ? branchId : null,
                    email: email.trim(),
                    active: true,
                  });
                  props.onClose();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Could not restore access.",
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              Restore access
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              className="w-full"
              disabled={!canSave || saving}
              onClick={() => void saveChanges()}
            >
              {saving ? <LoadingText>Saving</LoadingText> : "Save changes"}
            </Button>
            <div className="flex justify-center pt-1">
              <TextLinkButton
                className="text-red-700 hover:text-red-800"
                disabled={saving}
                onClick={async () => {
                  if (
                    !confirm(
                      "Disable this person's access? Their past reimbursements stay in the system.",
                    )
                  ) {
                    return;
                  }
                  await props.onRemove(employee.id);
                  props.onClose();
                }}
              >
                Disable access
              </TextLinkButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
