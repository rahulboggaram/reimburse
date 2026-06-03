"use client";

import { useMe } from "@/components/me-provider";
import {
  claimsTableGridNoStatus,
  claimsTableGridWithStatus,
  claimsTableHeaderClass,
  claimsTableRowClass,
} from "@/components/claims-table-layout";
import { StatusBadge } from "@/components/status-badge";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimDisplayStatus } from "@/lib/claim-display-status";
import { formatDisplayDateNoYear } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function ApprovalsTableHeader(props: { showStatus?: boolean }) {
  const showStatus = props.showStatus !== false;
  const grid = showStatus ? claimsTableGridWithStatus : claimsTableGridNoStatus;

  return (
    <div className={claimsTableHeaderClass(grid)}>
      <span className="min-w-0 truncate">Employee</span>
      <span className="whitespace-nowrap">Date</span>
      <span className="text-right whitespace-nowrap">Amount</span>
      {showStatus ? <span className="min-w-0">Status</span> : null}
      <span className="flex justify-center" aria-hidden />
    </div>
  );
}

export function ApprovalsTableRow(props: {
  claim: SerializedClaim;
  onOpen: () => void;
  showStatus?: boolean;
}) {
  const { claim } = props;
  const { user } = useMe();
  const showStatus = props.showStatus !== false;
  const status = claimDisplayStatus(claim, user?.role);
  const grid = showStatus ? claimsTableGridWithStatus : claimsTableGridNoStatus;

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={cn(claimsTableRowClass(grid), "w-full")}
    >
      <span className="min-w-0 truncate text-left text-sm font-medium text-zinc-900">
        {claim.employeeName}
      </span>
      <span className="text-left text-sm whitespace-nowrap text-zinc-600 tabular-nums">
        {formatDisplayDateNoYear(claim.expenseDate)}
      </span>
      <span className="text-right text-sm font-semibold whitespace-nowrap text-zinc-900 tabular-nums">
        ₹{claim.amount.toLocaleString("en-IN")}
      </span>
      {showStatus ? (
        <span className="flex min-w-0 items-center">
          <StatusBadge status={status} compact />
        </span>
      ) : null}
      <span
        className="flex items-center justify-center text-base leading-none text-zinc-400"
        aria-hidden
      >
        ›
      </span>
    </button>
  );
}
