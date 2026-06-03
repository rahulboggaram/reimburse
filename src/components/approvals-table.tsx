"use client";

import { useMe } from "@/components/me-provider";
import {
  approvalsTableGrid,
  claimsTableColCenter,
  claimsTableColChevron,
  claimsTableColStart,
  claimsTableHeaderClass,
  claimsTableRowClass,
} from "@/components/claims-table-layout";
import { StatusBadge } from "@/components/status-badge";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimDisplayStatus } from "@/lib/claim-display-status";
import { formatDisplayDateNoYear } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function ApprovalsTableHeader(props: {
  showStatus?: boolean;
  showCategory?: boolean;
}) {
  const showStatus = props.showStatus !== false;
  const showCategory = props.showCategory === true;
  const grid = approvalsTableGrid({ showCategory, showStatus });

  return (
    <div className={claimsTableHeaderClass(grid)}>
      {showCategory ? (
        <span className={cn(claimsTableColStart, "truncate")}>Category</span>
      ) : null}
      <span className={cn(claimsTableColStart, "truncate")}>Employee</span>
      <span className={cn(claimsTableColCenter, "whitespace-nowrap")}>Date</span>
      <span className={cn(claimsTableColCenter, "whitespace-nowrap")}>
        Amount
      </span>
      {showStatus ? <span className={claimsTableColCenter}>Status</span> : null}
      <span className={claimsTableColChevron} aria-hidden />
    </div>
  );
}

export function ApprovalsTableRow(props: {
  claim: SerializedClaim;
  onOpen: () => void;
  showStatus?: boolean;
  showCategory?: boolean;
}) {
  const { claim } = props;
  const { user } = useMe();
  const showStatus = props.showStatus !== false;
  const showCategory = props.showCategory === true;
  const status = claimDisplayStatus(claim, user?.role);
  const grid = approvalsTableGrid({ showCategory, showStatus });

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={claimsTableRowClass(grid)}
    >
      {showCategory ? (
        <span
          className={cn(
            claimsTableColStart,
            "truncate text-sm font-medium text-zinc-900",
          )}
        >
          {claim.category}
        </span>
      ) : null}
      <span
        className={cn(
          claimsTableColStart,
          "truncate text-sm font-medium text-zinc-900",
        )}
      >
        {claim.employeeName}
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
      {showStatus ? (
        <span className={claimsTableColCenter}>
          <StatusBadge status={status} compact className="mx-auto" />
        </span>
      ) : null}
      <span className={claimsTableColChevron} aria-hidden>
        ›
      </span>
    </button>
  );
}
