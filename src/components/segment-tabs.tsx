"use client";

import { cn } from "@/lib/utils";

export type SegmentTab<T extends string> = {
  id: T;
  label: string;
};

export function SegmentTabs<T extends string>(props: {
  tabs: SegmentTab<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={props.ariaLabel ?? "Sections"}
      className={cn("grid gap-1 rounded-xl bg-zinc-100 p-1", props.className)}
      style={{
        gridTemplateColumns: `repeat(${props.tabs.length}, minmax(0, 1fr))`,
      }}
    >
      {props.tabs.map((tab) => {
        const selected = props.value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => props.onChange(tab.id)}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm font-semibold transition-all sm:px-4",
              selected
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80"
                : "text-zinc-500 hover:text-zinc-700",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
