"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function PillChevron(props: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn(
        "size-4 shrink-0 text-zinc-500 transition-transform",
        props.open && "rotate-180",
      )}
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function RoleFilterPill<T extends string>(props: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel?: string;
  /** Pill label when the default / “all” value is selected */
  pillLabelWhenAll?: string;
  allValue?: T;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const allValue = props.allValue ?? props.options[0]?.value;
  const selected = props.options.find((option) => option.value === props.value);
  const triggerLabel =
    props.pillLabelWhenAll && props.value === allValue
      ? props.pillLabelWhenAll
      : (selected?.label ?? props.pillLabelWhenAll ?? "Filter");

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={props.ariaLabel ?? "Filter by role"}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-full bg-white py-1.5 pr-2 pl-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
      >
        <span>{triggerLabel}</span>
        <PillChevron open={open} />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={props.ariaLabel ?? "Filter by role"}
          className="absolute top-[calc(100%+6px)] right-0 z-30 min-w-[11rem] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {props.options.map((option) => {
            const isSelected = option.value === props.value;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    props.onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full px-4 py-2.5 text-left text-sm font-medium transition-colors",
                    isSelected
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-800 hover:bg-zinc-50",
                  )}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
