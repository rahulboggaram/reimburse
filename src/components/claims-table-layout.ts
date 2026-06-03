import { cn } from "@/lib/utils";

/**
 * Fixed column widths so date / amount / status stay centered under their headers
 * in both My Claims and Approvals.
 */
export const claimsTableGridWithStatus =
  "grid w-full grid-cols-[minmax(0,1fr)_4rem_5.5rem_6rem_1.25rem] items-center gap-x-2 sm:gap-x-3";

export const claimsTableGridNoStatus =
  "grid w-full grid-cols-[minmax(0,1fr)_4rem_5.5rem_1.25rem] items-center gap-x-2 sm:gap-x-3";

export function claimsTableHeaderClass(grid: string) {
  return cn(
    grid,
    "border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-medium tracking-wide text-zinc-500 uppercase sm:px-5",
  );
}

export function claimsTableRowClass(grid: string) {
  return cn(
    grid,
    "w-full border-b border-zinc-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-zinc-50 sm:px-5",
  );
}

export const claimsTableColStart = "min-w-0 justify-self-start text-left";

export const claimsTableColCenter =
  "min-w-0 w-full justify-self-center text-center";

export const claimsTableColChevron =
  "flex w-full items-center justify-center justify-self-center text-base leading-none text-zinc-400";
