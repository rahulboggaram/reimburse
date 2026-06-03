"use client";

import type { SerializedClaim } from "@/lib/claim-types";
import { payoutInProgress } from "@/lib/claim-display-status";
import { formatDisplayDateTime } from "@/lib/dates";
import { toTitleCase } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

function branchManagerLabel(claim: SerializedClaim) {
  const name = claim.approver?.name?.trim();
  return name ? toTitleCase(name) : "branch manager";
}

type StepState = "complete" | "pending" | "current" | "rejected";

type TimelineStep = {
  title: string;
  date: string | null;
  state: StepState;
  hint?: string;
};

function buildTimelineSteps(claim: SerializedClaim): TimelineStep[] {
  const uploaded: TimelineStep = {
    title: "Uploaded",
    date: claim.createdAt,
    state: "complete",
  };

  if (claim.status === "REJECTED") {
    return [
      uploaded,
      {
        title: "Rejected",
        date: claim.decidedAt,
        state: "rejected",
      },
    ];
  }

  if (claim.status === "PENDING") {
    const manager = branchManagerLabel(claim);
    return [
      uploaded,
      {
        title: "Approval",
        date: null,
        state: "pending",
        hint: `Awaiting branch approval from ${manager}`,
      },
      {
        title: "Financial approval",
        date: null,
        state: "pending",
        hint: "After branch approval",
      },
    ];
  }

  const approval: TimelineStep = {
    title: "Approval",
    date: claim.decidedAt,
    state: claim.decidedAt ? "complete" : "pending",
  };

  if (claim.paidAt) {
    return [
      uploaded,
      approval,
      {
        title: "Financial approval",
        date: claim.paidAt,
        state: "complete",
      },
    ];
  }

  if (payoutInProgress(claim.payoutStatus)) {
    return [
      uploaded,
      approval,
      {
        title: "Financial approval",
        date: claim.payoutInitiatedAt,
        state: "current",
        hint: "Payment in progress",
      },
    ];
  }

  return [
    uploaded,
    approval,
    {
      title: "Financial approval",
      date: null,
      state: "pending",
      hint: "Awaiting finance approval",
    },
  ];
}

function dotStyles(state: StepState) {
  switch (state) {
    case "complete":
      return "border-zinc-900 bg-zinc-900";
    case "current":
      return "border-blue-600 bg-blue-600 ring-4 ring-blue-100";
    case "rejected":
      return "border-red-600 bg-red-600";
    default:
      return "border-zinc-300 bg-white";
  }
}

function lineStyles(state: StepState) {
  return state === "complete" || state === "current" || state === "rejected"
    ? "bg-zinc-300"
    : "bg-zinc-200";
}

export function ClaimTimeline(props: { claim: SerializedClaim }) {
  const steps = buildTimelineSteps(props.claim);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-4">
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const showDate = step.date && step.state !== "pending";

          return (
            <li key={step.title} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3 left-[0.4375rem] h-[calc(100%-0.75rem)] w-0.5 -translate-x-1/2",
                    lineStyles(step.state),
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-10 mt-0.5 size-2.5 shrink-0 rounded-full border-2",
                  dotStyles(step.state),
                )}
              />
              <div className="min-w-0 flex-1 pt-px">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    step.state === "rejected"
                      ? "text-red-800"
                      : step.state === "pending"
                        ? "text-zinc-500"
                        : "text-zinc-900",
                  )}
                >
                  {step.title}
                </p>
                {showDate ? (
                  <p className="mt-0.5 text-sm text-zinc-600 tabular-nums">
                    {formatDisplayDateTime(step.date!)}
                  </p>
                ) : step.hint ? (
                  <p className="mt-0.5 text-sm text-zinc-500">{step.hint}</p>
                ) : step.state === "pending" ? (
                  <p className="mt-0.5 text-sm text-zinc-400">Not yet</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
