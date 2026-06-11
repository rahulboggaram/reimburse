"use client";

import { useMe } from "@/components/me-provider";
import {
  claimsTableBodyCellClass,
  claimsTableBodyNumericClass,
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
  const isSubmitting = Boolean(claim.submitting);

  return (
    <div
      role={isSubmitting ? undefined : "button"}
      tabIndex={isSubmitting ? -1 : 0}
      onClick={isSubmitting ? undefined : props.onOpen}
      onKeyDown={
        isSubmitting
          ? undefined
          : (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                props.onOpen();
              }
            }
      }
      className={cn(
        claimsTableRowClass(claimsTableGridWithStatus),
        isSubmitting
          ? "opacity-90"
          : "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-inset",
      )}
    >
      <span
        className={cn(claimsTableColStart, claimsTableBodyCellClass, "truncate")}
      >
        {claim.category}
      </span>
      <span
        className={cn(
          claimsTableColCenter,
          claimsTableBodyNumericClass,
          "whitespace-nowrap",
        )}
      >
        {formatDisplayDateNoYear(claim.expenseDate)}
      </span>
      <span
        className={cn(
          claimsTableColCenter,
          claimsTableBodyNumericClass,
          "whitespace-nowrap",
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
    </div>
  );
}
