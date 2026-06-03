import { cn } from "@/lib/utils";

/** Shared column grid for claim tables (category / date / amount / status / chevron). */
export const claimsTableGridWithStatus =
  "grid w-full grid-cols-[minmax(0,1fr)_4.5rem_minmax(5rem,max-content)_minmax(0,6.75rem)_1.25rem] items-center gap-x-3";

export const claimsTableGridNoStatus =
  "grid w-full grid-cols-[minmax(0,1fr)_4.5rem_minmax(5rem,max-content)_1.25rem] items-center gap-x-3";

export function claimsTableHeaderClass(grid: string) {
  return cn(
    grid,
    "border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-medium tracking-wide text-zinc-500 uppercase sm:px-5",
  );
}

export function claimsTableRowClass(grid: string) {
  return cn(
    grid,
    "border-b border-zinc-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-zinc-50 sm:px-5",
  );
}
