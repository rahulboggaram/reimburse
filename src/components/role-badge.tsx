import { cn } from "@/lib/utils";

const roleStyles: Record<string, string> = {
  Admin: "bg-zinc-900 text-white ring-1 ring-zinc-700/30",
  Employee: "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80",
  "Branch Manager": "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80",
  "Payment Approver": "bg-violet-100 text-violet-900 ring-1 ring-violet-200/80",
};

export function RoleBadge(props: { role: string }) {
  const label = props.role.trim() || "Employee";

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        roleStyles[label] ?? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200/80",
      )}
    >
      {label}
    </span>
  );
}
