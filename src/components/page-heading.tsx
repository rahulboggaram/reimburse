import { toTitleCase } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

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
      <Heading className={headingClass}>{toTitleCase(props.title)}</Heading>
      {props.description ? (
        <p className="text-sm text-zinc-600">{props.description}</p>
      ) : null}
    </div>
  );
}
