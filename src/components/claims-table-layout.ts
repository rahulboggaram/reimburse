import { cn } from "@/lib/utils";

/** Explicit grid tracks (static strings) so Tailwind v4 emits grid-template-columns. */
const gridBase = "grid w-full items-center gap-x-4";

export const claimsTableGridWithStatus = cn(
  gridBase,
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

export const claimsTableGridNoStatus = cn(
  gridBase,
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

export const claimsTableGridWithCategory = cn(
  gridBase,
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

export const claimsTableGridWithCategoryAndStatus = cn(
  gridBase,
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

const claimsTableGridWithStatusSelectable = cn(
  gridBase,
  "grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

const claimsTableGridNoStatusSelectable = cn(
  gridBase,
  "grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

const claimsTableGridWithCategorySelectable = cn(
  gridBase,
  "grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

const claimsTableGridWithCategoryAndStatusSelectable = cn(
  gridBase,
  "grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

export function approvalsTableGrid(options: {
  showCategory?: boolean;
  showStatus?: boolean;
  selectable?: boolean;
}) {
  const showCategory = options.showCategory === true;
  const showStatus = options.showStatus !== false;
  const selectable = options.selectable === true;

  if (showCategory) {
    if (showStatus) {
      return selectable
        ? claimsTableGridWithCategoryAndStatusSelectable
        : claimsTableGridWithCategoryAndStatus;
    }
    return selectable
      ? claimsTableGridWithCategorySelectable
      : claimsTableGridWithCategory;
  }

  if (showStatus) {
    return selectable
      ? claimsTableGridWithStatusSelectable
      : claimsTableGridWithStatus;
  }

  return selectable
    ? claimsTableGridNoStatusSelectable
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
    "w-full border-b border-zinc-200 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-zinc-50/80 sm:px-5",
  );
}

export const claimsTableColCheckbox =
  "flex shrink-0 items-center justify-center justify-self-center";

export const claimsTableColStart = "min-w-0 justify-self-stretch truncate text-left";

export const claimsTableColCenter =
  "min-w-0 justify-self-stretch truncate text-center";

export const claimsTableColChevron =
  "flex shrink-0 items-center justify-center justify-self-center text-base leading-none text-zinc-400";
