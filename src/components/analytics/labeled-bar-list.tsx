"use client";

import { cn } from "@/lib/utils";

export function LabeledBarList(props: {
  items: { label: string; value: number; sublabel?: string }[];
  formatValue?: (value: number) => string;
  barClassName?: string;
  emptyLabel?: string;
}) {
  const format = props.formatValue ?? ((value: number) => String(value));
  const max = Math.max(...props.items.map((item) => item.value), 1);

  if (props.items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {props.emptyLabel ?? "No data in this period."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {props.items.map((item) => (
        <li key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-zinc-900">
              {item.label}
            </span>
            <span className="shrink-0 text-zinc-600">
              {format(item.value)}
              {item.sublabel ? (
                <span className="text-zinc-400"> · {item.sublabel}</span>
              ) : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={cn(
                "h-full rounded-full",
                props.barClassName ?? "bg-emerald-600",
              )}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
