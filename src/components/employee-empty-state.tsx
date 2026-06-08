import Link from "next/link";
import { cn } from "@/lib/utils";

export function EmployeeEmptyState(props: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  actionClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-16 text-center sm:py-24",
        props.className,
      )}
    >
      <div className="mb-5" aria-hidden>
        <span className="font-brand text-3xl text-zinc-900">₹</span>
      </div>
      <p className="text-base font-semibold text-zinc-900">{props.title}</p>
      <p className="mt-1 max-w-xs text-sm leading-relaxed text-zinc-500">
        {props.description}
      </p>
      <Link
        href={props.actionHref}
        className={cn(
          "mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800",
          props.actionClassName,
        )}
      >
        {props.actionLabel}
      </Link>
    </div>
  );
}
