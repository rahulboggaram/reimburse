import { cn } from "@/lib/utils";

export function Input(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-base outline-none ring-zinc-900 focus-visible:ring-2",
        props.className,
      )}
    />
  );
}
