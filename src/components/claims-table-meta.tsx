"use client";

import { StatusBadge } from "@/components/status-badge";
import { claimsTableColMeta } from "@/components/claims-table-layout";
import { cn } from "@/lib/utils";

export function ClaimsTableMetaHeader(props: { showStatus?: boolean }) {
  return (
    <span className={cn(claimsTableColMeta, "text-[11px] uppercase tracking-wide")}>
      {props.showStatus === false ? "Date & amount" : "Details"}
    </span>
  );
}

export function ClaimsTableMetaCell(props: {
  dateLabel: string;
  amountLabel: string;
  status?: string;
  showStatus?: boolean;
}) {
  const showStatus = props.showStatus !== false && props.status != null;

  return (
    <div className={claimsTableColMeta}>
      <span className="text-xs whitespace-nowrap text-zinc-500 tabular-nums">
        {props.dateLabel}
      </span>
      <span className="text-sm font-semibold whitespace-nowrap text-zinc-900 tabular-nums">
        {props.amountLabel}
      </span>
      {showStatus ? (
        <StatusBadge status={props.status!} compact className="max-w-full" />
      ) : null}
    </div>
  );
}
