"use client";

import { useMe } from "@/components/me-provider";
import {
  claimsTableColChevron,
  claimsTableColStart,
  claimsTableGridWithStatus,
  claimsTableHeaderClass,
  claimsTableRowClass,
} from "@/components/claims-table-layout";
import {
  ClaimsTableMetaCell,
  ClaimsTableMetaHeader,
} from "@/components/claims-table-meta";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimDisplayStatus } from "@/lib/claim-display-status";
import { formatDisplayDateNoYear } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function MyClaimsTableHeader() {
  return (
    <div className={claimsTableHeaderClass(claimsTableGridWithStatus)}>
      <span className={cn(claimsTableColStart, "truncate")}>Category</span>
      <ClaimsTableMetaHeader />
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
      <ClaimsTableMetaCell
        dateLabel={formatDisplayDateNoYear(claim.expenseDate)}
        amountLabel={`₹${claim.amount.toLocaleString("en-IN")}`}
        status={status}
      />
      <span className={claimsTableColChevron} aria-hidden>
        ›
      </span>
    </button>
  );
}
