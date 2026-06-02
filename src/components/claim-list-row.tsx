"use client";

import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export function ClaimListRow(props: {
  title: string;
  subtitle: string;
  amount: number;
  approvalStatus: string;
  paymentStatus?: string | null;
  onOpen: () => void;
}) {
  const relevantStatus = (() => {
    if (props.approvalStatus === "REJECTED") return "REJECTED";
    if (props.approvalStatus === "PENDING") return "PENDING";

    // Once approved, payment status becomes the most relevant signal.
    if (props.approvalStatus === "APPROVED") {
      return props.paymentStatus ?? "APPROVED";
    }

    // For paid claims, show the final state.
    if (props.approvalStatus === "PAID") return "PAID";

    return props.approvalStatus;
  })();

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900">{props.title}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-500">{props.subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold font-tabular-nums text-zinc-900">
          ₹{props.amount.toLocaleString("en-IN")}
        </p>
        <div className="mt-1 flex justify-end">
          <StatusBadge status={relevantStatus} />
        </div>
      </div>
      <span
        className="shrink-0 text-lg text-zinc-400"
        aria-hidden
      >
        ›
      </span>
    </button>
  );
}
