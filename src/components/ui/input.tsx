import { cn } from "@/lib/utils";

export function Input(props: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-11 w-full rounded-xl border border-zinc-200/80 bg-white px-3.5 text-base shadow-sm shadow-zinc-200/30 outline-none transition-shadow focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-800/20",
        props.className,
      )}
    />
  );
}
