import { cn } from "@/lib/utils";

const chevronCol = "1.25rem";
const checkboxCol = "2rem";
/** Date, amount, and status stacked in one column. */
const metaCol = "max-content";

/** Checkbox column: narrow, left-aligned, always first. */
export const claimsTableColCheckbox =
  "flex shrink-0 items-center justify-start justify-self-start";

function buildGridTemplate(parts: string[]) {
  return `grid-cols-[${parts.join("_")}]`;
}

export function approvalsTableGrid(options: {
  showCategory?: boolean;
  showStatus?: boolean;
  selectable?: boolean;
}) {
  const showCategory = options.showCategory === true;
  const cols: string[] = [];

  if (options.selectable) cols.push(checkboxCol);
  cols.push("minmax(0,1fr)");
  if (showCategory) cols.push("minmax(0,0.85fr)");
  cols.push(metaCol);
  cols.push(chevronCol);

  return cn("grid w-full items-center gap-x-2", buildGridTemplate(cols));
}

export function claimsTableHeaderClass(grid: string) {
  return cn(
    grid,
    "border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase sm:px-5",
  );
}

export function claimsTableRowClass(grid: string) {
  return cn(
    grid,
    "min-h-[3.25rem] w-full border-b border-zinc-100 px-4 py-2 transition-colors last:border-b-0 hover:bg-zinc-50 sm:px-5",
  );
}

export const claimsTableColStart =
  "min-w-0 justify-self-stretch truncate text-left leading-snug";

export const claimsTableColCenter =
  "min-w-0 justify-self-stretch truncate text-center leading-snug";

/** Right column: date, amount, and status stacked vertically. */
export const claimsTableColMeta =
  "flex min-w-0 flex-col items-end justify-center gap-0.5 justify-self-end text-right leading-tight";

export const claimsTableColChevron =
  "flex shrink-0 items-center justify-center justify-self-center text-base leading-none text-zinc-400";

/** My claims table (category, date, amount, status). */
export const claimsTableGridWithStatus = cn(
  "grid w-full items-center gap-x-2",
  buildGridTemplate(["minmax(0,1fr)", metaCol, chevronCol]),
);
