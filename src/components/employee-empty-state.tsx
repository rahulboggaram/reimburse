import Link from "next/link";
import { Card } from "@/components/ui/card";
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
    <Card
      className={cn(
        "flex flex-col items-center px-6 py-10 text-center",
        props.className,
      )}
    >
      <div
        className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-zinc-100 ring-1 ring-zinc-200"
        aria-hidden
      >
        <span className="font-brand text-2xl text-zinc-800">₹</span>
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
    </Card>
  );
}
