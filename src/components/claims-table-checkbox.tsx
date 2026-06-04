"use client";

import { TimelineCheckMark } from "@/components/timeline-check-mark";
import { cn } from "@/lib/utils";

const boxClass =
  "flex size-[1.125rem] shrink-0 items-center justify-center rounded-full border-2 transition-colors";

export function ClaimsTableCheckbox(props: {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: () => void;
  onClick?: (event: React.MouseEvent) => void;
  "aria-label": string;
}) {
  const filled = props.checked || props.indeterminate;

  return (
    <label
      className="inline-flex cursor-pointer items-center justify-center rounded-full focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-zinc-900"
      onClick={props.onClick}
      onMouseDown={props.onClick}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={props.checked}
        ref={(el) => {
          if (el) {
            el.indeterminate = Boolean(props.indeterminate && !props.checked);
          }
        }}
        onChange={props.onChange}
        onClick={props.onClick}
        aria-label={props["aria-label"]}
      />
      <span
        aria-hidden
        className={cn(
          boxClass,
          filled
            ? "border-zinc-900 bg-zinc-900"
            : "border-zinc-300 bg-white",
        )}
      >
        {props.checked ? (
          <TimelineCheckMark className="size-3.5" />
        ) : props.indeterminate ? (
          <span className="block h-0.5 w-2.5 rounded-full bg-white" />
        ) : null}
      </span>
    </label>
  );
}
