"use client";

import { PageInfoTip } from "@/components/page-info-tip";
import { UserMenu } from "@/components/user-menu";
import { toTitleCase } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export function PageHeading(props: {
  title: string;
  description?: string;
  /** Shown via (i) next to the title on hover or tap. */
  info?: string;
  as?: "h1" | "h2";
  className?: string;
  /** Show account menu (name + arrow) aligned with the title. Default true. */
  accountMenu?: boolean;
}) {
  const Heading = props.as ?? "h1";
  const headingClass =
    props.as === "h2"
      ? "font-brand-title text-lg text-zinc-900 sm:text-xl"
      : "font-brand-title text-xl text-zinc-900 sm:text-2xl";
  const showAccountMenu = props.accountMenu !== false;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        props.className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <Heading className={headingClass}>{toTitleCase(props.title)}</Heading>
          {props.info ? <PageInfoTip text={props.info} /> : null}
        </div>
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
