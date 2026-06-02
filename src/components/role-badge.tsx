import { cn } from "@/lib/utils";

const neutralRoleStyle =
  "bg-gradient-to-r from-zinc-50 to-white text-zinc-800 ring-1 ring-zinc-200 shadow-sm";

const roleStyles: Record<string, string> = {
  Admin: "bg-zinc-900 text-white ring-1 ring-zinc-800",
  Employee: neutralRoleStyle,
  "Branch Manager": neutralRoleStyle,
  "Payment Approver": "bg-violet-50 text-violet-900 ring-1 ring-violet-200/90",
};

export function RoleBadge(props: { role: string }) {
  const label = props.role.trim() || "Employee";

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3.5 py-1.5 text-xs font-medium",
        roleStyles[label] ?? "bg-zinc-50 text-zinc-800 ring-1 ring-zinc-200",
      )}
    >
      {label}
    </span>
  );
}
