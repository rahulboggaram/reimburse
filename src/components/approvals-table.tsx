"use client";

import { useMe } from "@/components/me-provider";
import {
  approvalsTableGrid,
  claimsTableColCenter,
  claimsTableColCheckbox,
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

function stopRowClick(event: React.MouseEvent) {
  event.stopPropagation();
}

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
        <span className={claimsTableColCheckbox}>
          <input
            type="checkbox"
            className="size-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-600"
            checked={props.allSelected}
            ref={(el) => {
              if (el) {
                el.indeterminate = Boolean(
                  props.someSelected && !props.allSelected,
                );
              }
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

function rowCells(props: {
  claim: SerializedClaim;
  showStatus: boolean;
  showCategory: boolean;
  status: string;
}) {
  const { claim, showStatus, showCategory, status } = props;
  return (
    <>
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
    </>
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

  if (props.selectable) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={props.onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            props.onOpen();
          }
        }}
        className={cn(
          claimsTableRowClass(grid),
          "cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-inset",
        )}
      >
        <label
          className={claimsTableColCheckbox}
          onClick={stopRowClick}
          onMouseDown={stopRowClick}
        >
          <input
            type="checkbox"
            className="size-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-600"
            checked={props.selected}
            onChange={props.onToggleSelect}
            onClick={stopRowClick}
            aria-label={`Select ${claim.employeeName}`}
          />
        </label>
        {rowCells({ claim, showStatus, showCategory, status })}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={claimsTableRowClass(grid)}
    >
      {rowCells({ claim, showStatus, showCategory, status })}
    </button>
  );
}
