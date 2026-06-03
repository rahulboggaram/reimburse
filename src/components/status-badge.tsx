import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  AWAITING: "Awaiting",
  QUEUED: "Queued",
};

/** Light tint background + saturated text for readable compact badges. */
const successStyle = "bg-emerald-50 text-emerald-600";
const errorStyle = "bg-red-50 text-red-600";
/** In-progress / waiting states (Queued, Awaiting, paying). */
const progressStyle = "bg-blue-50 text-blue-600";
const neutralStyle = "bg-zinc-100 text-zinc-600";

const styles: Record<string, string> = {
  PENDING: progressStyle,
  pending: progressStyle,
  AWAITING: progressStyle,
  awaiting: progressStyle,
  QUEUED: progressStyle,
  queued: progressStyle,
  APPROVED: successStyle,
  PAID: successStyle,
  processed: successStyle,
  REJECTED: errorStyle,
  failed: errorStyle,
  rejected: errorStyle,
  reversed: errorStyle,
  cancelled: errorStyle,
  paying: progressStyle,
  processing: progressStyle,
  "not started": neutralStyle,
  not_started: neutralStyle,
};

export function StatusBadge(props: {
  status: string;
  className?: string;
  compact?: boolean;
}) {
  const raw = props.status ?? "";
  const key = raw.includes("_") ? raw.toLowerCase() : raw;
  const label =
    labels[raw] ?? raw.replace(/_/g, " ").toLowerCase();
  const useCapitalize = !labels[raw];
  const compact = props.compact === true;

  return (
    <span
      title={label}
      className={cn(
        "inline-flex max-w-full items-center rounded-full font-semibold",
        compact
          ? "truncate px-2.5 py-1 text-xs leading-normal"
          : "px-3 py-1.5 text-sm leading-normal",
        useCapitalize && "capitalize",
        styles[key] ?? styles[raw] ?? styles[label] ?? neutralStyle,
        props.className,
      )}
    >
      {label}
    </span>
  );
}
