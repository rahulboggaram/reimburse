"use client";

import { cn } from "@/lib/utils";

export const peoplePillTriggerClass =
  "flex items-center gap-1.5 rounded-full bg-card-bg py-1.5 pr-2 pl-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200";

function SearchIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      className="size-4 shrink-0 text-zinc-500"
    >
      <path
        d="M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m13.5 13.5 3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PeopleSearchPill(props: {
  open: boolean;
  onToggle: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-expanded={props.open}
      aria-label="Search employees"
      onClick={props.onToggle}
      className={cn(
        peoplePillTriggerClass,
        "pl-2 pr-3",
        props.open && "bg-zinc-200",
        props.active && !props.open && "bg-zinc-200 hover:bg-zinc-300",
      )}
    >
      <SearchIcon />
      <span>Search</span>
    </button>
  );
}
