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

const employeeCellClass =
  "truncate text-sm font-semibold text-zinc-900";

const bodyCellClass =
  "text-sm font-normal text-zinc-600 tabular-nums";

export function ApprovalsTableHeader(props: {
  showStatus?: boolean;
  showCategory?: boolean;
}) {
  const showStatus = props.showStatus !== false;
  const showCategory = props.showCategory === true;
  const grid = approvalsTableGrid({ showCategory, showStatus });

  return (
    <div className={claimsTableHeaderClass(grid)}>
      <span className={cn(claimsTableColStart, "truncate")}>Employee</span>
      {showCategory ? (
        <span className={cn(claimsTableColStart, "truncate")}>Category</span>
      ) : null}
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
      <span className={cn(claimsTableColStart, employeeCellClass)}>
        {claim.employeeName}
      </span>
      {showCategory ? (
        <span className={cn(claimsTableColStart, bodyCellClass, "truncate")}>
          {claim.category}
        </span>
      ) : null}
      <span className={cn(claimsTableColCenter, bodyCellClass, "whitespace-nowrap")}>
        {formatDisplayDateNoYear(claim.expenseDate)}
      </span>
      <span
        className={cn(
          claimsTableColCenter,
          bodyCellClass,
          "whitespace-nowrap",
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
