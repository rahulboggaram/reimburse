"use client";

import type { UserRole } from "@prisma/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { ASSIGNABLE_ROLES, formatRole } from "@/lib/access-roles";
import { findBranchStaff, type BranchStaffMember } from "@/lib/branch-staff";
import {
  HEAD_OFFICE_BRANCH_NAME,
  listHeadOfficePaymentApprovers,
} from "@/lib/payment-approver";
import { userRoleRequiresBranch } from "@/lib/user-branch";
import { formatPhoneDisplay } from "@/lib/phone";
import { listRowInsetDividerClass } from "@/components/claims-table-layout";
import { cn } from "@/lib/utils";

export type EmployeeRecord = {
  id: string;
  phone: string;
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
        <p className="mt-0.5 truncate text-sm text-zinc-900">
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

function staffLabel(
  person: { name?: string | null } | null,
  fallback: string,
) {
  return person?.name?.trim() || fallback;
}

export function EmployeeDetailModal(props: {
  employee: EmployeeRecord | null;
  people: EmployeeRecord[];
  open: boolean;
  onClose: () => void;
  branches: { id: string; name: string; active: boolean }[];
  onUpdate: (update: {
    id: string;
    role: UserRole;
    branchId: string | null;
    active?: boolean;
  }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  if (!props.employee) return null;

  const employee = props.employee;
  const [role, setRole] = useState<UserRole>(employee.role);
  const [branchId, setBranchId] = useState<string>(employee.branchId ?? "");

  useEffect(() => {
    setRole(employee.role);
    setBranchId(employee.branchId ?? "");
  }, [employee.id, employee.role, employee.branchId]);

  const needsBranch = userRoleRequiresBranch(role);
  const branchStaff = findBranchStaff(props.people, branchId || employee.branchId);
  const branchLabel =
    props.branches.find((branch) => branch.id === (branchId || employee.branchId))
      ?.name ?? employee.branchName;
  const headOfficeApprovers = listHeadOfficePaymentApprovers(props.people);

  function commitUpdate(nextRole: UserRole, nextBranchId: string | null) {
    const nextNeedsBranch = userRoleRequiresBranch(nextRole);
    if (nextNeedsBranch && !nextBranchId) return;
    void props.onUpdate({
      id: employee.id,
      role: nextRole,
      branchId: nextNeedsBranch ? nextBranchId : null,
    });
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
            <Label htmlFor={`${employee.id}-role`}>Role</Label>
            <Select
              id={`${employee.id}-role`}
              value={role}
              onChange={(e) => {
                const nextRole = e.target.value as UserRole;
                setRole(nextRole);

                const nextNeedsBranch = userRoleRequiresBranch(nextRole);
                if (!nextNeedsBranch) setBranchId("");
                commitUpdate(
                  nextRole,
                  nextNeedsBranch ? branchId || null : null,
                );
              }}
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
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
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  setBranchId(next);
                  commitUpdate(role, next);
                }}
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

        {branchLabel ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
            <p className="font-medium text-zinc-900">{branchLabel} setup</p>
            <ul className="mt-2 space-y-1 text-zinc-600">
              <li>
                Branch manager:{" "}
                {branchStaff.branchManager ? (
                  <span className="font-medium text-zinc-900">
                    {staffLabel(branchStaff.branchManager, "Assigned")}
                  </span>
                ) : (
                  <span className="text-amber-800">Not assigned</span>
                )}
              </li>
            </ul>
            {!branchStaff.branchManager ? (
              <p className="mt-2 text-xs text-amber-800">
                Employees on this branch need a branch manager before they can
                submit claims.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
          <p className="font-medium text-zinc-900">
            {HEAD_OFFICE_BRANCH_NAME} — payments
          </p>
          <p className="mt-1 text-zinc-600">
            Payment approvers handle approved claims from all branches. They
            cannot pay their own claims or admin claims.
          </p>
          <ul className="mt-2 space-y-1 text-zinc-600">
            {headOfficeApprovers.length > 0 ? (
              headOfficeApprovers.map((person) => (
                <li key={person.id}>
                  <span className="font-medium text-zinc-900">
                    {staffLabel(person, "Payment approver")}
                  </span>
                  {person.branchName ? ` · ${person.branchName}` : ""}
                </li>
              ))
            ) : (
              <li className="text-amber-800">No payment approver assigned</li>
            )}
          </ul>
        </div>

        {!employee.active ? (
          <>
            <p className="text-sm text-zinc-600">
              This person is inactive. Confirm their role and branch, then restore
              access.
            </p>
            {needsBranch && !branchId ? (
              <p className="text-sm text-amber-800">
                Select an active branch before restoring.
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={needsBranch && !branchId}
              onClick={async () => {
                await props.onUpdate({
                  id: employee.id,
                  role,
                  branchId: needsBranch ? branchId : null,
                  active: true,
                });
                props.onClose();
              }}
            >
              Restore access
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            type="button"
            className="w-full border-red-200 text-red-700"
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
          </Button>
        )}
      </div>
    </Modal>
  );
}
