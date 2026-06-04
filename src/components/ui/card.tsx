import { cn } from "@/lib/utils";

export function Card(props: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border-[1.5px] border-zinc-300 bg-transparent p-5",
        props.className,
      )}
    />
  );
}
