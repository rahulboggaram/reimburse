import { cn } from "@/lib/utils";

const profileTagStyle =
  "bg-zinc-50 text-zinc-900 ring-1 ring-zinc-200 shadow-sm";

export function ProfileTag(props: { children: string }) {
  const label = props.children.trim();
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3.5 py-1.5 text-xs font-medium",
        profileTagStyle,
      )}
    >
      {label}
    </span>
  );
}

export function RoleBadge(props: { role: string }) {
  return <ProfileTag>{props.role.trim() || "Employee"}</ProfileTag>;
}
