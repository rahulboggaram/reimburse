"use client";

import { useMe } from "@/components/me-provider";
import {
  claimsTableGridWithStatus,
  claimsTableHeaderClass,
  claimsTableRowClass,
} from "@/components/claims-table-layout";
import { StatusBadge } from "@/components/status-badge";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimDisplayStatus } from "@/lib/claim-display-status";
import { formatDisplayDateNoYear } from "@/lib/dates";

export function MyClaimsTableHeader() {
  return (
    <div className={claimsTableHeaderClass(claimsTableGridWithStatus)}>
      <span className="min-w-0 truncate">Category</span>
      <span className="whitespace-nowrap">Date</span>
      <span className="text-right whitespace-nowrap">Amount</span>
      <span className="min-w-0">Status</span>
      <span className="flex justify-center" aria-hidden />
    </div>
  );
}

export function MyClaimsTableRow(props: {
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
      className={claimsTableRowClass(claimsTableGridWithStatus)}
    >
      <span className="min-w-0 truncate text-left text-sm font-medium text-zinc-900">
        {claim.category}
      </span>
      <span className="text-left text-sm whitespace-nowrap text-zinc-600 tabular-nums">
        {formatDisplayDateNoYear(claim.expenseDate)}
      </span>
      <span className="text-right text-sm font-semibold whitespace-nowrap text-zinc-900 tabular-nums">
        ₹{claim.amount.toLocaleString("en-IN")}
      </span>
      <span className="flex min-w-0 items-center">
        <StatusBadge status={status} compact />
      </span>
      <span
        className="flex items-center justify-center text-base leading-none text-zinc-400"
        aria-hidden
      >
        ›
      </span>
    </button>
  );
}
