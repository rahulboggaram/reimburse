import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  PENDING_FINANCE_APPROVAL: "Pending finance approval",
};

const styles: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  pending_finance_approval: "bg-violet-100 text-violet-900",
  PENDING_FINANCE_APPROVAL: "bg-violet-100 text-violet-900",
  APPROVED: "bg-emerald-100 text-emerald-800",
  PAID: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  paying: "bg-blue-100 text-blue-800",
  queued: "bg-blue-100 text-blue-800",
  pending: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  processed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
  reversed: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
  "not started": "bg-zinc-100 text-zinc-700",
  not_started: "bg-zinc-100 text-zinc-700",
};

type IconKind = "pending" | "finance" | "success" | "error" | "progress";

function iconKindForStatus(raw: string, key: string): IconKind {
  const lower = raw.toLowerCase();

  if (raw === "PENDING_FINANCE_APPROVAL" || key === "pending_finance_approval") {
    return "finance";
  }
  if (lower === "pending" || raw === "PENDING" || lower === "not_started") {
    return "pending";
  }
  if (
    lower === "approved" ||
    raw === "APPROVED" ||
    raw === "PAID" ||
    lower === "processed" ||
    lower === "paid"
  ) {
    return "success";
  }
  if (
    lower === "rejected" ||
    raw === "REJECTED" ||
    lower === "failed" ||
    lower === "reversed" ||
    lower === "cancelled"
  ) {
    return "error";
  }
  if (lower === "paying" || lower === "queued" || lower === "processing") {
    return "progress";
  }
  return "pending";
}

function StatusIcon(props: { kind: IconKind; className?: string }) {
  const className = cn("size-3 shrink-0", props.className);

  switch (props.kind) {
    case "success":
      return (
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={className}>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "error":
      return (
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={className}>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "progress":
      return (
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={className}>
          <path
            fillRule="evenodd"
            d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466.75.75 0 1 1-1.254-.834 4 4 0 0 0 7.28-1.148.75.75 0 0 1 1.175.516ZM4.75 10a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H5.5a.75.75 0 0 1-.75-.75Zm11-2.5a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm-2.97-3.53a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06ZM6.22 5.22a.75.75 0 0 1 0 1.06L5.16 7.34a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "finance":
      return (
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={className}>
          <path d="M10 2a6 6 0 0 0-6 6c0 1.887.454 3.665 1.257 5.234a.75.75 0 0 0 .857.386h7.772a.75.75 0 0 0 .857-.386A12.96 12.96 0 0 0 16 8a6 6 0 0 0-6-6Zm0 14.5a.75.75 0 0 1-.53-.22l-2.25-2.25a.75.75 0 1 1 1.06-1.06l1.72 1.72 1.72-1.72a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-.53.22Z" />
        </svg>
      );
    default:
      return (
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={className}>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.5a.75.75 0 0 0-1.5 0v4.25c0 .414.336.75.75.75h3a.75.75 0 0 0 0-1.5h-2.25V6.5Z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

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
  const iconKind = iconKindForStatus(raw, key);

  return (
    <span
      title={label}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full font-semibold ring-1 ring-inset ring-black/5",
        props.compact
          ? "truncate px-2 py-0.5 text-[10px] leading-tight"
          : "px-2.5 py-0.5 text-xs",
        useCapitalize && "capitalize",
        styles[key] ?? styles[raw] ?? styles[label] ?? "bg-zinc-100 text-zinc-700",
        props.className,
      )}
    >
      <StatusIcon kind={iconKind} />
      <span className="truncate">{label}</span>
    </span>
  );
}
