import { cn } from "@/lib/utils";

/** Explicit grid tracks (static strings) so Tailwind v4 emits grid-template-columns. */
const gridBase = "grid w-full items-center gap-x-4";

export const claimsTableGridWithStatus = cn(
  gridBase,
  "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

export const claimsTableGridNoStatus = cn(
  gridBase,
  "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

export const claimsTableGridWithCategory = cn(
  gridBase,
  "grid-cols-[minmax(0,1.2fr)_minmax(0,0.78fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

export const claimsTableGridWithCategoryAndStatus = cn(
  gridBase,
  "grid-cols-[minmax(0,1.2fr)_minmax(0,0.78fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

const claimsTableGridWithStatusSelectable = cn(
  gridBase,
  "grid-cols-[2rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

const claimsTableGridNoStatusSelectable = cn(
  gridBase,
  "grid-cols-[2rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

const claimsTableGridWithCategorySelectable = cn(
  gridBase,
  "grid-cols-[2rem_minmax(0,1.2fr)_minmax(0,0.78fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
);

const claimsTableGridWithCategoryAndStatusSelectable = cn(
  gridBase,
  "grid-cols-[2rem_minmax(0,1.2fr)_minmax(0,0.78fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_1.25rem]",
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

const tableInsetDividerAfter = (selectable?: boolean) =>
  cn(
    "after:pointer-events-none after:absolute after:bottom-0 after:h-px after:bg-zinc-200/90",
    selectable
      ? "after:left-[calc(1rem+2rem+1rem)] sm:after:left-[calc(1.25rem+2rem+1rem)]"
      : "after:left-4 sm:after:left-5",
    "after:right-4 sm:after:right-5",
  );

export const claimsTableHeaderLabelClass =
  "text-xs font-medium capitalize text-zinc-700";

export const claimsTableBodyCellClass =
  "text-sm font-normal text-zinc-500";

export const claimsTableBodyNumericClass =
  "text-sm font-normal text-zinc-500 tabular-nums";

export function claimsTableHeaderClass(
  grid: string,
  options?: { selectable?: boolean },
) {
  return cn(
    grid,
    "relative bg-zinc-200/70 px-4 py-2.5 sm:px-5",
    tableInsetDividerAfter(options?.selectable),
    claimsTableHeaderLabelClass,
  );
}

export function claimsTableRowClass(
  grid: string,
  options?: { selectable?: boolean; selected?: boolean },
) {
  return cn(
    grid,
    "relative w-full bg-white px-4 py-3 text-left transition-colors sm:px-5",
    options?.selected ? "hover:bg-white" : "hover:bg-zinc-50/80",
    tableInsetDividerAfter(options?.selectable),
    "last:after:hidden",
  );
}

/** Inset row divider for non-grid list rows (e.g. People employee list). */
export const listRowInsetDividerClass = cn(
  "relative after:pointer-events-none after:absolute after:bottom-0 after:h-px after:bg-zinc-200/90 after:left-4 after:right-4 last:after:hidden sm:after:left-5 sm:after:right-5",
);

export const claimsTableColCheckbox =
  "flex shrink-0 items-center justify-center justify-self-center";

export const claimsTableColStart = "min-w-0 justify-self-stretch truncate text-left";

export const claimsTableColCenter =
  "min-w-0 justify-self-stretch truncate text-center";

export const claimsTableColChevron =
  "flex shrink-0 items-center justify-center justify-self-center text-base leading-none text-zinc-400";
