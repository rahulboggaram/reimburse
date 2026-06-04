import { cn } from "@/lib/utils";

const chevronCol = "1.25rem";
const checkboxCol = "2.25rem";

/** Checkbox column: narrow, left-aligned, always first. */
export const claimsTableColCheckbox =
  "flex shrink-0 items-center justify-start justify-self-start";

export function approvalsTableGrid(options: {
  showCategory?: boolean;
  showStatus?: boolean;
  selectable?: boolean;
}) {
  const showStatus = options.showStatus !== false;
  const showCategory = options.showCategory === true;
  const prefix = options.selectable ? `${checkboxCol}_` : "";
  const gap = "gap-x-3";

  if (showCategory) {
    const dataCols = showStatus ? 5 : 4;
    return cn(
      "grid w-full items-center",
      gap,
      `grid-cols-[${prefix}repeat(${dataCols},minmax(0,1fr))_${chevronCol}]`,
    );
  }

  const dataCols = showStatus ? 4 : 3;
  return cn(
    "grid w-full items-center",
    gap,
    `grid-cols-[${prefix}repeat(${dataCols},minmax(0,1fr))_${chevronCol}]`,
  );
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
  "min-w-0 justify-self-stretch text-center";

export const claimsTableColChevron =
  "flex items-center justify-center justify-self-center text-base leading-none text-zinc-400";

/** My claims table (category, date, amount, status). */
export const claimsTableGridWithStatus = approvalsTableGrid({
  showCategory: true,
  showStatus: true,
  selectable: false,
});
