import { cn } from "@/lib/utils";

/** Checkmark inside the “done” timeline dot (claim detail popup). */
export function TimelineCheckMark(props: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={cn("text-white", props.className)}
      fill="none"
    >
      <path
        d="M5.25 10.25 8.25 13.25 14.75 6.75"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
