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
  selectable?: boolean;
  allSelected?: boolean;
  someSelected?: boolean;
  onToggleAll?: () => void;
}) {
  const showStatus = props.showStatus !== false;
  const showCategory = props.showCategory === true;
  const grid = approvalsTableGrid({
    showCategory,
    showStatus,
    selectable: props.selectable,
  });

  return (
    <div className={claimsTableHeaderClass(grid)}>
      {props.selectable ? (
        <span className="flex items-center justify-center">
          <input
            type="checkbox"
            className="size-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-600"
            checked={props.allSelected}
            ref={(el) => {
              if (el) el.indeterminate = Boolean(props.someSelected && !props.allSelected);
            }}
            onChange={props.onToggleAll}
            aria-label="Select all in list"
          />
        </span>
      ) : null}
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
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { claim } = props;
  const { user } = useMe();
  const showStatus = props.showStatus !== false;
  const showCategory = props.showCategory === true;
  const status = claimDisplayStatus(claim, user?.role);
  const grid = approvalsTableGrid({
    showCategory,
    showStatus,
    selectable: props.selectable,
  });

  return (
    <div className={claimsTableRowClass(grid)}>
      {props.selectable ? (
        <label
          className="flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className="size-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-600"
            checked={props.selected}
            onChange={props.onToggleSelect}
            aria-label={`Select ${claim.employeeName}`}
          />
        </label>
      ) : null}
      <button
        type="button"
        onClick={props.onOpen}
        className={cn(
          "contents text-left",
          props.selectable ? "[&>span]:cursor-pointer" : "",
        )}
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
    </div>
  );
}
