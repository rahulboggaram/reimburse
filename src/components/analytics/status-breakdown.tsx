"use client";

import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-400",
  APPROVED: "bg-blue-500",
  REJECTED: "bg-red-400",
  PAID: "bg-emerald-600",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

export function StatusBreakdown(props: {
  items: { status: string; count: number }[];
}) {
  const total = props.items.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return <p className="text-sm text-zinc-500">No claims in this period.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-zinc-100">
        {props.items.map((item) => (
          <div
            key={item.status}
            className={cn(STATUS_STYLES[item.status] ?? "bg-zinc-400")}
            style={{ width: `${(item.count / total) * 100}%` }}
            title={`${STATUS_LABELS[item.status] ?? item.status}: ${item.count}`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {props.items.map((item) => (
          <li key={item.status} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                STATUS_STYLES[item.status] ?? "bg-zinc-400",
              )}
            />
            <span className="text-zinc-700">
              {STATUS_LABELS[item.status] ?? item.status}{" "}
              <span className="text-zinc-500">({item.count})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
