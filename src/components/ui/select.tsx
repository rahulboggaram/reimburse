import { cn } from "@/lib/utils";

/** Matches floating field border colors */
export const fieldOutlineColors = {
  idle: "#71717a",
  focused: "#2563eb",
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
    fieldSize?: "default" | "sm";
  },
) {
  const { outlineColor, fieldSize = "default", className, style, ...rest } =
    props;
  const isPlaceholderSelected =
    typeof rest.value === "string" ? rest.value.length === 0 : false;
  const stroke = outlineColor ?? fieldOutlineColors.idle;

  return (
    <select
      {...rest}
      className={cn(
        "flex w-full appearance-none rounded-xl border-0 bg-white bg-no-repeat outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15",
        fieldSize === "sm"
          ? "h-10 bg-size-[1rem] bg-position-[right_0.75rem_center] py-0 pl-3 pr-10 text-sm"
          : "h-field bg-size-[1.375rem] bg-position-[right_1rem_center] py-3 pl-4 pr-12 text-base",
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
