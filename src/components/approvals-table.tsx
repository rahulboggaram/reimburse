"use client";

import { useMe } from "@/components/me-provider";
import {
  claimsTableColCenter,
  claimsTableColChevron,
  claimsTableColStart,
  claimsTableGridNoStatus,
  claimsTableGridWithStatus,
  claimsTableHeaderClass,
  claimsTableRowClass,
} from "@/components/claims-table-layout";
import { StatusBadge } from "@/components/status-badge";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimDisplayStatus } from "@/lib/claim-display-status";
import {
  formatDisplayDateNoYear,
  formatDisplayDateTimeNoYear,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

export function ApprovalsTableHeader(props: {
  showStatus?: boolean;
  showApprovalTime?: boolean;
}) {
  const showStatus = props.showStatus !== false;
  const showApprovalTime = props.showApprovalTime === true;
  const grid = showStatus ? claimsTableGridWithStatus : claimsTableGridNoStatus;

  return (
    <div className={claimsTableHeaderClass(grid)}>
      <span className={cn(claimsTableColStart, "truncate")}>Employee</span>
      <span className={cn(claimsTableColCenter, "whitespace-nowrap")}>
        {showApprovalTime ? "Approved" : "Date"}
      </span>
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
  showApprovalTime?: boolean;
}) {
  const { claim } = props;
  const { user } = useMe();
  const showStatus = props.showStatus !== false;
  const showApprovalTime = props.showApprovalTime === true;
  const status = claimDisplayStatus(claim, user?.role);
  const grid = showStatus ? claimsTableGridWithStatus : claimsTableGridNoStatus;
  const dateLabel = showApprovalTime
    ? claim.decidedAt
      ? formatDisplayDateTimeNoYear(claim.decidedAt)
      : "—"
    : formatDisplayDateNoYear(claim.expenseDate);

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={claimsTableRowClass(grid)}
    >
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
          "text-xs leading-snug text-zinc-600 tabular-nums sm:text-sm",
          !showApprovalTime && "whitespace-nowrap",
        )}
      >
        {dateLabel}
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
