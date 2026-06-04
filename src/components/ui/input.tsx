import { cn } from "@/lib/utils";

export function Input(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-field w-full rounded-xl border-0 bg-white px-4 text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-zinc-900/15",
        props.className,
      )}
    />
  );
}
