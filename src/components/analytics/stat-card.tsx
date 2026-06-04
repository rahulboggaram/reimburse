import { cn } from "@/lib/utils";

export function StatCard(props: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-card-bg p-4",
        props.className,
      )}
    >
      <p className="text-xs font-medium text-zinc-500">{props.label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
        {props.value}
      </p>
      {props.hint ? (
        <p className="mt-1 text-xs text-zinc-500">{props.hint}</p>
      ) : null}
    </div>
  );
}
