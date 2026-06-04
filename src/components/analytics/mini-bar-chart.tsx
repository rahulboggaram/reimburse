"use client";

import { formatDisplayDateNoYear } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function MiniBarChart(props: {
  data: { date: string; value: number }[];
  className?: string;
  barClassName?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(...props.data.map((point) => point.value), 1);

  if (props.data.every((point) => point.value === 0)) {
    return (
      <p className="text-sm text-zinc-500">
        {props.emptyLabel ?? "No activity in this period."}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", props.className)}>
      <div className="flex h-28 items-end gap-0.5">
        {props.data.map((point) => {
          const height = Math.max(8, Math.round((point.value / max) * 100));
          return (
            <div
              key={point.date}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${formatDisplayDateNoYear(point.date)}: ${point.value}`}
            >
              <div
                className={cn(
                  "w-full min-w-[3px] max-w-3 rounded-t-sm",
                  props.barClassName ?? "bg-emerald-600",
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span>{formatDisplayDateNoYear(props.data[0]!.date)}</span>
        <span>
          {formatDisplayDateNoYear(props.data[props.data.length - 1]!.date)}
        </span>
      </div>
    </div>
  );
}
