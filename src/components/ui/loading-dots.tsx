import { cn } from "@/lib/utils";

export function LoadingDots(props: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1", props.className)}
      aria-hidden
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 shrink-0 rounded-full bg-current animate-loading-dot"
          style={{ animationDelay: `${index * 0.4}s` }}
        />
      ))}
    </span>
  );
}

/** Button label with animated dots (pass text without trailing …). */
export function LoadingText(props: { children: string }) {
  const text = props.children.replace(/\.{2,}$|…$/u, "").trimEnd();
  return (
    <span className="inline-flex items-center gap-2">
      <span>{text}</span>
      <LoadingDots />
    </span>
  );
}
