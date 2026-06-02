import { cn } from "@/lib/utils";

const chevronDown =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2371717a'%3E%3Cpath fill-rule='evenodd' d='M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z' clip-rule='evenodd'/%3E%3C/svg%3E\")";

export function Select(props: React.ComponentProps<"select">) {
  const isPlaceholderSelected =
    typeof props.value === "string" ? props.value.length === 0 : false;

  return (
    <select
      {...props}
      className={cn(
        "flex h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-white bg-size-[1.25rem] bg-position-[right_0.875rem_center] bg-no-repeat py-2 pl-4 pr-11 text-base outline-none ring-zinc-900 focus-visible:ring-2",
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
