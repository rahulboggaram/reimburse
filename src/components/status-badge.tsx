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
  // RazorpayX payout statuses
  queued: "bg-blue-100 text-blue-800",
  pending: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  processed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  rejected: "bg-red-100 text-red-800",
  reversed: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
  "not started": "bg-zinc-100 text-zinc-700",
  "not_started": "bg-zinc-100 text-zinc-700",
};

export function StatusBadge(props: { status: string }) {
  const raw = props.status ?? "";
  const key = raw.includes("_") ? raw.toLowerCase() : raw;
  const label =
    labels[raw] ?? raw.replace(/_/g, " ").toLowerCase();
  const useCapitalize = !labels[raw];

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-black/5",
        useCapitalize && "capitalize",
        styles[key] ?? styles[raw] ?? styles[label] ?? "bg-zinc-100 text-zinc-700",
      )}
    >
      {label}
    </span>
  );
}
