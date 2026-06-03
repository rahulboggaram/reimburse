import { cn } from "@/lib/utils";

const roleBadgeStyle =
  "bg-zinc-50 text-zinc-900 ring-1 ring-zinc-200 shadow-sm";

export function RoleBadge(props: { role: string }) {
  const label = props.role.trim() || "Employee";

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3.5 py-1.5 text-xs font-medium",
        roleBadgeStyle,
      )}
    >
      {label}
    </span>
  );
}
