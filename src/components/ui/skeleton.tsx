import { cn } from "@/lib/utils";

/** Grey placeholder block — use instead of showing stub or fake text while data loads. */
export function Skeleton(props: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-zinc-200", props.className)}
      aria-hidden
    />
  );
}
