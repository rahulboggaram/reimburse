import { cn } from "@/lib/utils";

export function Card(props: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl bg-card-bg p-5",
        props.className,
      )}
    />
  );
}
