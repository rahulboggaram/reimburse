"use client";

import { useMe } from "@/components/me-provider";
import { StatusBadge } from "@/components/status-badge";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimDisplayStatus } from "@/lib/claim-display-status";
import { formatDisplayDate } from "@/lib/dates";

const gridCols =
  "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.75fr)_minmax(0,0.7fr)_1.5rem] items-center gap-2";

export function ApprovalsTableHeader() {
  return (
    <div
      className={`${gridCols} border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-medium tracking-wide text-zinc-500 uppercase`}
    >
      <span>Employee</span>
      <span>Category</span>
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
      className={`${gridCols} w-full border-b border-zinc-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-zinc-50`}
    >
      <span className="truncate text-sm font-medium text-zinc-900">
        {claim.employeeName}
      </span>
      <span className="truncate text-sm text-zinc-600">{claim.category}</span>
      <span className="truncate text-sm text-zinc-600">
        {formatDisplayDate(claim.expenseDate)}
      </span>
      <span className="truncate text-right text-sm font-semibold font-tabular-nums text-zinc-900">
        ₹{claim.amount.toLocaleString("en-IN")}
      </span>
      <span>
        <StatusBadge status={status} />
      </span>
      <span className="text-center text-lg text-zinc-400" aria-hidden>
        ›
      </span>
    </button>
  );
}
