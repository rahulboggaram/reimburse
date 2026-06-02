"use client";

import type { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ASSIGNABLE_ROLES, formatRole } from "@/lib/access-roles";
import { formatPhoneDisplay } from "@/lib/phone";
import { maskAccountNumber } from "@/lib/user-profile";

export type EmployeeRecord = {
  id: string;
  phone: string;
  name: string | null;
  ifscCode: string | null;
  bankAccountNumber: string | null;
  role: UserRole;
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
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`truncate font-medium ${employee.name ? "text-zinc-900" : "text-zinc-500"}`}
          >
            {displayName}
          </p>
          {!employee.active ? (
            <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
              Removed
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-zinc-500">
          {formatPhoneDisplay(employee.phone)}
          {employee.signedUp
            ? ` · ${employee.claimCount} claim${employee.claimCount === 1 ? "" : "s"}`
            : " · Pending signup"}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
        {formatRole(employee.role)}
      </span>
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
  onUpdateRole: (id: string, role: UserRole) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  if (!props.employee) return null;

  const employee = props.employee;

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
              {employee.ifscCode} ·{" "}
              {maskAccountNumber(employee.bankAccountNumber ?? "")}
            </p>
          ) : (
            <p className="text-amber-700">Waiting for first login & profile</p>
          )}
          <p className="text-zinc-500">
            {employee.claimCount} reimbursement
            {employee.claimCount === 1 ? "" : "s"} submitted
          </p>
        </div>

        <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <Label htmlFor={`${employee.id}-role`}>Role</Label>
          <Select
            id={`${employee.id}-role`}
            value={employee.role}
            onChange={(e) =>
              props.onUpdateRole(employee.id, e.target.value as UserRole)
            }
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {formatRole(role)}
              </option>
            ))}
          </Select>
        </div>

        <Button
          variant="outline"
          type="button"
          className="w-full border-red-200 text-red-700"
          onClick={async () => {
            if (!confirm("Remove this employee's access?")) return;
            await props.onRemove(employee.id);
            props.onClose();
          }}
        >
          Remove employee
        </Button>
      </div>
    </Modal>
  );
}
