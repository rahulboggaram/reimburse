"use client";

import { cn } from "@/lib/utils";

export type ActiveInactiveTab = "active" | "inactive";

export function ActiveInactiveTabs(props: {
  value: ActiveInactiveTab;
  onChange: (value: ActiveInactiveTab) => void;
  className?: string;
}) {
  const segments: { id: ActiveInactiveTab; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "inactive", label: "Inactive" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Status"
      className={cn(
        "grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1",
        props.className,
      )}
    >
      {segments.map((segment) => {
        const selected = props.value === segment.id;
        return (
          <button
            key={segment.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => props.onChange(segment.id)}
            className={cn(
              "rounded-lg px-4 py-2.5 text-sm font-semibold transition-all",
              selected
                ? "bg-zinc-200 text-zinc-900"
                : "text-zinc-500 hover:text-zinc-700",
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
