"use client";

import { useMe } from "@/components/me-provider";
import { toTitleCase, userDisplayLabel } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export function UserNameAside() {
  const { user, loading } = useMe();

  if (loading) {
    return (
      <div
        className="h-4 w-24 shrink-0 animate-pulse rounded bg-zinc-200"
        aria-hidden
      />
    );
  }

  if (!user) return null;

  return (
    <span className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-medium text-emerald-900 ring-1 ring-emerald-100/80 shadow-sm">
      {userDisplayLabel(user)}
    </span>
  );
}

export function PageHeading(props: {
  title: string;
  description?: string;
  as?: "h1" | "h2";
  className?: string;
}) {
  const Heading = props.as ?? "h1";
  const headingClass =
    props.as === "h2"
      ? "font-semibold text-zinc-900"
      : "text-2xl font-semibold tracking-tight text-zinc-900";

  return (
    <div className={cn("space-y-1", props.className)}>
      <div className="flex items-start justify-between gap-3">
        <Heading className={headingClass}>{toTitleCase(props.title)}</Heading>
        <UserNameAside />
      </div>
      {props.description ? (
        <p className="text-sm text-zinc-600">{props.description}</p>
      ) : null}
    </div>
  );
}
