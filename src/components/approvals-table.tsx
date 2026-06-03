"use client";

import { useMe } from "@/components/me-provider";
import { StatusBadge } from "@/components/status-badge";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimDisplayStatus } from "@/lib/claim-display-status";
import { formatDisplayDateNoYear } from "@/lib/dates";

const gridCols =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,4.5rem)_minmax(0,5.5rem)_minmax(0,1fr)_1.25rem] items-center gap-x-3";

export function ApprovalsTableHeader() {
  return (
    <div
      className={`${gridCols} border-b border-zinc-200 bg-zinc-50 px-5 py-2.5 text-xs font-medium tracking-wide text-zinc-500 uppercase`}
    >
      <span>Employee</span>
      <span>Date</span>
      <span className="text-right">Amount</span>
      <span>Status</span>
      <span aria-hidden />
    </div>
  );
}

export function ApprovalsTableRow(props: {
  claim: SerializedClaim;
  onOpen: () => void;
}) {
  const { claim } = props;
  const { user } = useMe();
  const status = claimDisplayStatus(claim, user?.role);

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={`${gridCols} w-full border-b border-zinc-100 px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-zinc-50`}
    >
      <span className="truncate text-sm font-medium text-zinc-900">
        {claim.employeeName}
      </span>
      <span className="text-sm text-zinc-600 tabular-nums">
        {formatDisplayDateNoYear(claim.expenseDate)}
      </span>
      <span className="text-right text-sm font-semibold font-tabular-nums text-zinc-900">
        ₹{claim.amount.toLocaleString("en-IN")}
      </span>
      <span className="min-w-0">
        <StatusBadge status={status} />
      </span>
      <span className="text-center text-lg text-zinc-400" aria-hidden>
        ›
      </span>
    </button>
  );
}
