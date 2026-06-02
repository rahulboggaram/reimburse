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

    if (props.approvalStatus === "APPROVED") {
      return props.paymentStatus ?? "APPROVED";
    }

    if (props.approvalStatus === "PAID") return "PAID";

    return props.approvalStatus;
  })();

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white/95 p-4 text-left shadow-md shadow-zinc-200/35 backdrop-blur-sm transition-all",
        "hover:border-zinc-300 hover:shadow-lg hover:shadow-zinc-200/60 active:scale-[0.99]",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-zinc-900">{props.title}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-500">{props.subtitle}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-semibold font-tabular-nums text-zinc-900">
          ₹{props.amount.toLocaleString("en-IN")}
        </p>
        <div className="mt-1.5 flex justify-end">
          <StatusBadge status={relevantStatus} />
        </div>
      </div>
    </button>
  );
}
