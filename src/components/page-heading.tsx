"use client";

import { UserMenu } from "@/components/user-menu";
import { toTitleCase } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export function PageHeading(props: {
  title: string;
  description?: string;
  as?: "h1" | "h2";
  className?: string;
  /** Show account menu (name + arrow) aligned with the title. Default true. */
  accountMenu?: boolean;
}) {
  const Heading = props.as ?? "h1";
  const headingClass =
    props.as === "h2"
      ? "font-semibold text-zinc-900"
      : "text-2xl font-semibold tracking-tight text-zinc-900";
  const showAccountMenu = props.accountMenu !== false;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        props.className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <Heading className={headingClass}>{toTitleCase(props.title)}</Heading>
        {props.description ? (
          <p className="text-sm text-zinc-600">{props.description}</p>
        ) : null}
      </div>
      {showAccountMenu ? (
        <div className="shrink-0 self-center">
          <UserMenu />
        </div>
      ) : null}
    </div>
  );
}
