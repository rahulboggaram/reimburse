import { cn } from "@/lib/utils";

/** Equal-width data columns + narrow chevron; shared gap between columns. */
export const claimsTableGridWithStatus =
  "grid w-full grid-cols-[repeat(4,minmax(0,1fr))_1.25rem] items-center gap-x-4";

export const claimsTableGridNoStatus =
  "grid w-full grid-cols-[repeat(3,minmax(0,1fr))_1.25rem] items-center gap-x-4";

/** Approved tab: category + employee + date + amount */
export const claimsTableGridWithCategory =
  "grid w-full grid-cols-[repeat(4,minmax(0,1fr))_1.25rem] items-center gap-x-4";

/** Approved tab with status column */
export const claimsTableGridWithCategoryAndStatus =
  "grid w-full grid-cols-[repeat(5,minmax(0,1fr))_1.25rem] items-center gap-x-4";

export function approvalsTableGrid(options: {
  showCategory?: boolean;
  showStatus?: boolean;
}) {
  if (options.showCategory) {
    return options.showStatus !== false
      ? claimsTableGridWithCategoryAndStatus
      : claimsTableGridWithCategory;
  }
  return options.showStatus !== false
    ? claimsTableGridWithStatus
    : claimsTableGridNoStatus;
}

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

export const claimsTableColStart = "min-w-0 justify-self-stretch text-left";

export const claimsTableColCenter =
  "flex min-w-0 w-full items-center justify-center justify-self-stretch text-center";

export const claimsTableColChevron =
  "flex w-full items-center justify-center justify-self-center text-base leading-none text-zinc-400";
