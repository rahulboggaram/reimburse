import { cn } from "@/lib/utils";

export function Card(props: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-zinc-200/70 bg-white/95 p-5 shadow-md shadow-zinc-200/40 backdrop-blur-sm",
        props.className,
      )}
    />
  );
}
