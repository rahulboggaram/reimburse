import { cn } from "@/lib/utils";

/** Bolder stroke chevron for dropdown fields */
const chevronDown =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2352525b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

export function Select(props: React.ComponentProps<"select">) {
  const isPlaceholderSelected =
    typeof props.value === "string" ? props.value.length === 0 : false;

  return (
    <select
      {...props}
      className={cn(
        "flex h-field w-full appearance-none rounded-xl border border-zinc-200 bg-white bg-size-[1.375rem] bg-position-[right_1rem_center] bg-no-repeat py-3 pl-4 pr-12 text-base outline-none ring-zinc-900 focus-visible:ring-2",
        isPlaceholderSelected ? "text-zinc-400" : "text-zinc-900",
        props.className,
      )}
      style={{
        backgroundImage: chevronDown,
        ...props.style,
      }}
    />
  );
}
