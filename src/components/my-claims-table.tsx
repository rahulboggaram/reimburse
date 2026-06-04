"use client";

import { useMe } from "@/components/me-provider";
import {
  claimsTableColCenter,
  claimsTableColChevron,
  claimsTableColStart,
  claimsTableGridWithStatus,
  claimsTableHeaderClass,
  claimsTableRowClass,
} from "@/components/claims-table-layout";
import { StatusBadge } from "@/components/status-badge";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimDisplayStatus } from "@/lib/claim-display-status";
import { formatDisplayDateNoYear } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function MyClaimsTableHeader() {
  return (
    <div className={claimsTableHeaderClass(claimsTableGridWithStatus)}>
      <span className={cn(claimsTableColStart, "truncate")}>Category</span>
      <span className={cn(claimsTableColCenter, "whitespace-nowrap")}>Date</span>
      <span className={cn(claimsTableColCenter, "whitespace-nowrap")}>
        Amount
      </span>
      <span className={claimsTableColCenter}>Status</span>
      <span className={claimsTableColChevron} aria-hidden />
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
      <span
        className={cn(
          claimsTableColStart,
          "truncate text-sm font-medium text-zinc-900",
        )}
      >
        {claim.category}
      </span>
      <span
        className={cn(
          claimsTableColCenter,
          "text-sm whitespace-nowrap text-zinc-600 tabular-nums",
        )}
      >
        {formatDisplayDateNoYear(claim.expenseDate)}
      </span>
      <span
        className={cn(
          claimsTableColCenter,
          "text-sm font-semibold whitespace-nowrap text-zinc-900 tabular-nums",
        )}
      >
        ₹{claim.amount.toLocaleString("en-IN")}
      </span>
      <span className={cn(claimsTableColCenter, "flex justify-center")}>
        <StatusBadge status={status} compact />
      </span>
      <span className={claimsTableColChevron} aria-hidden>
        ›
      </span>
    </button>
  );
}
