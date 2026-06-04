import { cn } from "@/lib/utils";

/** Matches floating field border colors */
export const fieldOutlineColors = {
  idle: "#71717a",
  focused: "#ea580c",
  error: "#9f1239",
} as const;

export function chevronBackground(stroke: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${stroke}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function Select(
  props: React.ComponentProps<"select"> & {
    /** Chevron stroke — defaults to idle outline grey */
    outlineColor?: string;
  },
) {
  const { outlineColor, className, style, ...rest } = props;
  const isPlaceholderSelected =
    typeof rest.value === "string" ? rest.value.length === 0 : false;
  const stroke = outlineColor ?? fieldOutlineColors.idle;

  return (
    <select
      {...rest}
      className={cn(
        "flex h-field w-full appearance-none rounded-xl border border-zinc-200 bg-white bg-size-[1.375rem] bg-position-[right_1rem_center] bg-no-repeat py-3 pl-4 pr-12 text-base outline-none ring-zinc-900 focus-visible:ring-2",
        isPlaceholderSelected ? "text-zinc-400" : "text-zinc-900",
        className,
      )}
      style={{
        backgroundImage: chevronBackground(stroke),
        ...style,
      }}
    />
  );
}
