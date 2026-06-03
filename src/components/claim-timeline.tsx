"use client";

import type { SerializedClaim } from "@/lib/claim-types";
import { payoutInProgress } from "@/lib/claim-display-status";
import { formatDisplayDateTime } from "@/lib/dates";
import { toTitleCase } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

type VisualState = "done" | "awaiting" | "upcoming" | "rejected";

type TimelineStep = {
  key: string;
  title: string;
  subtext?: string;
  visual: VisualState;
};

function personLabel(name: string | null | undefined, fallback: string) {
  const trimmed = name?.trim();
  return trimmed ? toTitleCase(trimmed) : fallback;
}

function uploadedStep(claim: SerializedClaim): TimelineStep {
  const who = personLabel(claim.employeeName, "Employee");
  return {
    key: "uploaded",
    title: "Uploaded",
    subtext: `by ${who} · ${formatDisplayDateTime(claim.createdAt)}`,
    visual: "done",
  };
}

function branchManagerLabel(claim: SerializedClaim) {
  return personLabel(claim.approver?.name, "branch manager");
}

function buildTimelineSteps(claim: SerializedClaim): TimelineStep[] {
  const uploaded = uploadedStep(claim);
  const manager = branchManagerLabel(claim);

  if (claim.status === "REJECTED") {
    return [
      uploaded,
      {
        key: "rejected",
        title: "Rejected",
        subtext: claim.decidedAt
          ? `by ${manager} · ${formatDisplayDateTime(claim.decidedAt)}`
          : `by ${manager}`,
        visual: "rejected",
      },
    ];
  }

  if (claim.status === "PENDING") {
    return [
      uploaded,
      {
        key: "approval-waiting",
        title: "Awaiting",
        subtext: `approval by ${manager}`,
        visual: "awaiting",
      },
      {
        key: "finance-next",
        title: "Financial approval",
        subtext: "Up next",
        visual: "upcoming",
      },
    ];
  }

  const approvalDone: TimelineStep = {
    key: "approval-done",
    title: "Approved",
    subtext: claim.decidedAt
      ? `by ${manager} · ${formatDisplayDateTime(claim.decidedAt)}`
      : `by ${manager}`,
    visual: "done",
  };

  if (claim.paidAt) {
    return [
      uploaded,
      approvalDone,
      {
        key: "finance-done",
        title: "Financial approval",
        subtext: formatDisplayDateTime(claim.paidAt),
        visual: "done",
      },
    ];
  }

  if (payoutInProgress(claim.payoutStatus)) {
    return [
      uploaded,
      approvalDone,
      {
        key: "finance-progress",
        title: "Awaiting financial approval",
        subtext: claim.payoutInitiatedAt
          ? `payment in progress · ${formatDisplayDateTime(claim.payoutInitiatedAt)}`
          : "payment in progress",
        visual: "awaiting",
      },
    ];
  }

  return [
    uploaded,
    approvalDone,
    {
      key: "finance-waiting",
      title: "Awaiting financial approval",
      subtext: "pending payment",
      visual: "awaiting",
    },
  ];
}

function titleStyles(visual: VisualState) {
  switch (visual) {
    case "done":
      return "text-zinc-900";
    case "awaiting":
      return "text-amber-700";
    case "upcoming":
      return "text-zinc-400";
    case "rejected":
      return "text-red-700";
  }
}

function subtextStyles(visual: VisualState) {
  switch (visual) {
    case "done":
      return "text-zinc-500";
    case "awaiting":
      return "text-amber-600/90";
    case "upcoming":
      return "text-zinc-400";
    case "rejected":
      return "text-red-600/80";
  }
}

const DOT_SIZE = "size-5";
const DOT_CENTER = "left-[0.625rem]";

function connectorStyles(visual: VisualState) {
  return visual === "done" ? "bg-zinc-900" : "bg-zinc-200";
}

function TimelineDot(props: { visual: VisualState }) {
  const base = cn(
    "relative z-10 mt-0.5 shrink-0 rounded-full",
    DOT_SIZE,
  );

  if (props.visual === "done") {
    return (
      <span
        aria-hidden
        className={cn(base, "flex items-center justify-center bg-zinc-900")}
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="size-2.5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path
            d="M5.5 10.5 8.5 13.5 14.5 7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  if (props.visual === "rejected") {
    return (
      <span aria-hidden className={cn(base, "border-2 border-red-600 bg-red-600")} />
    );
  }

  const filled =
    props.visual === "awaiting"
      ? "border-2 border-amber-500 bg-amber-500"
      : "border-2 border-zinc-300 bg-zinc-200";

  return <span aria-hidden className={cn(base, filled)} />;
}

export function ClaimTimeline(props: { claim: SerializedClaim }) {
  const steps = buildTimelineSteps(props.claim);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4">
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-5 h-[calc(100%-0.75rem)] w-0.5 -translate-x-1/2",
                    DOT_CENTER,
                    connectorStyles(step.visual),
                  )}
                />
              ) : null}
              <TimelineDot visual={step.visual} />
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={cn(
                    "text-sm font-medium leading-snug",
                    titleStyles(step.visual),
                  )}
                >
                  {step.title}
                </p>
                {step.subtext ? (
                  <p
                    className={cn(
                      "mt-0.5 text-xs leading-snug tabular-nums",
                      subtextStyles(step.visual),
                    )}
                  >
                    {step.subtext}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
