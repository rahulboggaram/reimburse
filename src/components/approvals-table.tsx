"use client";

import { useMe } from "@/components/me-provider";
import {
  approvalsTableGrid,
  claimsTableBodyCellClass,
  claimsTableBodyNumericClass,
  claimsTableColCenter,
  claimsTableColCheckbox,
  claimsTableColChevron,
  claimsTableColStart,
  claimsTableHeaderClass,
  claimsTableRowClass,
} from "@/components/claims-table-layout";
import { ClaimsTableCheckbox } from "@/components/claims-table-checkbox";
import { StatusBadge } from "@/components/status-badge";
import type { SerializedClaim } from "@/lib/claim-types";
import { claimDisplayStatus } from "@/lib/claim-display-status";
import { formatDisplayDateNoYear } from "@/lib/dates";
import { cn } from "@/lib/utils";

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
  const selectable = props.selectable === true;
  const grid = approvalsTableGrid({ showCategory, showStatus, selectable });

  return (
    <div className={claimsTableHeaderClass(grid, { selectable })}>
      {selectable ? (
        <span className={claimsTableColCheckbox}>
          <ClaimsTableCheckbox
            checked={props.allSelected}
            indeterminate={props.someSelected}
            onChange={props.onToggleAll}
            aria-label="Select all reimbursements"
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
  const selectable = props.selectable === true;
  const status = claimDisplayStatus(claim, user?.role);
  const grid = approvalsTableGrid({ showCategory, showStatus, selectable });

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
        claimsTableRowClass(grid, { selectable }),
        "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-inset",
        selectable && props.selected && "bg-white",
      )}
    >
      {selectable ? (
        <span
          className={claimsTableColCheckbox}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <ClaimsTableCheckbox
            checked={props.selected}
            onChange={props.onToggleSelect}
            aria-label={`Select ${claim.employeeName}`}
          />
        </span>
      ) : null}
      <span className={cn(claimsTableColStart, claimsTableBodyCellClass, "truncate")}>
        {claim.employeeName}
      </span>
      {showCategory ? (
        <span className={cn(claimsTableColStart, claimsTableBodyCellClass, "truncate")}>
          {claim.category}
        </span>
      ) : null}
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
      {showStatus ? (
        <span className={cn(claimsTableColCenter, "flex justify-center")}>
          <StatusBadge status={status} compact />
        </span>
      ) : null}
      <span className={claimsTableColChevron} aria-hidden>
        ›
      </span>
    </div>
  );
}
