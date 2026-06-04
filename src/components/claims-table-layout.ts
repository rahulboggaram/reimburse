import { cn } from "@/lib/utils";

const checkboxCol = "2rem";
const chevronCol = "1.25rem";

function withOptionalCheckbox(template: string, selectable?: boolean) {
  if (!selectable) return template;
  return template.replace("grid-cols-[", `grid-cols-[${checkboxCol}_`);
}

/** Equal-width data columns + narrow chevron; shared gap between columns. */
const claimsTableGridWithStatusBase = `grid w-full grid-cols-[repeat(4,minmax(0,1fr))_${chevronCol}] items-center gap-x-4`;

const claimsTableGridNoStatusBase = `grid w-full grid-cols-[repeat(3,minmax(0,1fr))_${chevronCol}] items-center gap-x-4`;

const claimsTableGridWithCategoryBase = `grid w-full grid-cols-[repeat(4,minmax(0,1fr))_${chevronCol}] items-center gap-x-4`;

const claimsTableGridWithCategoryAndStatusBase = `grid w-full grid-cols-[repeat(5,minmax(0,1fr))_${chevronCol}] items-center gap-x-4`;

export const claimsTableGridWithStatus = claimsTableGridWithStatusBase;

export const claimsTableGridNoStatus = claimsTableGridNoStatusBase;

export const claimsTableGridWithCategory = claimsTableGridWithCategoryBase;

export const claimsTableGridWithCategoryAndStatus =
  claimsTableGridWithCategoryAndStatusBase;

export function approvalsTableGrid(options: {
  showCategory?: boolean;
  showStatus?: boolean;
  selectable?: boolean;
}) {
  let base: string;
  if (options.showCategory) {
    base =
      options.showStatus !== false
        ? claimsTableGridWithCategoryAndStatusBase
        : claimsTableGridWithCategoryBase;
  } else {
    base =
      options.showStatus !== false
        ? claimsTableGridWithStatusBase
        : claimsTableGridNoStatusBase;
  }
  return withOptionalCheckbox(base, options.selectable);
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

export const claimsTableColCheckbox =
  "flex shrink-0 items-center justify-center justify-self-start";

export const claimsTableColStart = "min-w-0 justify-self-stretch text-left";

export const claimsTableColCenter =
  "flex min-w-0 w-full items-center justify-center justify-self-stretch text-center";

export const claimsTableColChevron =
  "flex w-full items-center justify-center justify-self-center text-base leading-none text-zinc-400";
