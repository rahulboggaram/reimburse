import { cn } from "@/lib/utils";

type RoleStyle = {
  badge: string;
  dot: string;
};

const roleStyles: Record<string, RoleStyle> = {
  Admin: {
    badge: "bg-zinc-900 text-white ring-1 ring-zinc-800",
    dot: "bg-white/90",
  },
  Employee: {
    badge:
      "bg-gradient-to-r from-zinc-50 to-white text-zinc-800 ring-1 ring-zinc-200 shadow-sm",
    dot: "bg-blue-500",
  },
  "Branch Manager": {
    badge: "bg-sky-50 text-sky-900 ring-1 ring-sky-200/90",
    dot: "bg-sky-500",
  },
  "Payment Approver": {
    badge: "bg-violet-50 text-violet-900 ring-1 ring-violet-200/90",
    dot: "bg-violet-500",
  },
};

const defaultStyle: RoleStyle = {
  badge: "bg-zinc-50 text-zinc-800 ring-1 ring-zinc-200",
  dot: "bg-zinc-400",
};

export function RoleBadge(props: { role: string }) {
  const label = props.role.trim() || "Employee";
  const style = roleStyles[label] ?? defaultStyle;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium",
        style.badge,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", style.dot)}
        aria-hidden
      />
      {label}
    </span>
  );
}
