"use client";

import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  id: T;
  label: string;
};

export function SegmentControl<T extends string>(props: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const count = props.options.length;
  const index = Math.max(
    0,
    props.options.findIndex((option) => option.id === props.value),
  );

  return (
    <div
      role="tablist"
      aria-label={props.ariaLabel ?? "Options"}
      className={cn("relative w-full rounded-xl bg-zinc-200/80 p-1", props.className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 rounded-lg bg-card-bg shadow-sm ring-1 ring-zinc-200/60 transition-[transform,width] duration-200 ease-out"
        style={{
          width: `calc((100% - 8px) / ${count})`,
          transform: `translateX(calc(${index} * 100%))`,
          left: 4,
        }}
      />

      <div
        className="relative z-10 grid"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {props.options.map((option) => {
          const selected = props.value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => props.onChange(option.id)}
              className={cn(
                "rounded-lg px-2 py-2.5 text-center text-sm font-semibold transition-colors sm:px-3",
                selected ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-700",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
