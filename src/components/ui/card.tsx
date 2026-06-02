import { cn } from "@/lib/utils";

export function Card(props: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm",
        props.className,
      )}
    />
  );
}
