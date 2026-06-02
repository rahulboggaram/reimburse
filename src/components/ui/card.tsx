import { cn } from "@/lib/utils";

export function Card(props: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-200/50",
        props.className,
      )}
    />
  );
}
