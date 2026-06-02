import { cn } from "@/lib/utils";

export function Label(props: React.ComponentProps<"label">) {
  const { children, className, ...rest } = props;
  return (
    <label
      {...rest}
      className={cn("text-sm font-medium text-zinc-700", className)}
    >
      {children}
    </label>
  );
}
