"use client";

import type { SerializedClaim } from "@/lib/claim-types";
import { payoutInProgress } from "@/lib/claim-display-status";
import { formatDisplayDateTime } from "@/lib/dates";
import { toTitleCase } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

type VisualState = "done" | "awaiting" | "upcoming" | "rejected";

type TimelineStep = {
  key: string;
  line: string;
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
    line: `Uploaded by ${who} · ${formatDisplayDateTime(claim.createdAt)}`,
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
        line: claim.decidedAt
          ? `Rejected by ${manager} · ${formatDisplayDateTime(claim.decidedAt)}`
          : `Rejected by ${manager}`,
        visual: "rejected",
      },
    ];
  }

  if (claim.status === "PENDING") {
    return [
      uploaded,
      {
        key: "approval-waiting",
        line: `Awaiting approval from ${manager}`,
        visual: "awaiting",
      },
      {
        key: "finance-next",
        line: "Financial approval · up next",
        visual: "upcoming",
      },
    ];
  }

  const approvalDone: TimelineStep = {
    key: "approval-done",
    line: claim.decidedAt
      ? `Approved by ${manager} · ${formatDisplayDateTime(claim.decidedAt)}`
      : `Approved by ${manager}`,
    visual: "done",
  };

  if (claim.paidAt) {
    return [
      uploaded,
      approvalDone,
      {
        key: "finance-done",
        line: `Financial approval · ${formatDisplayDateTime(claim.paidAt)}`,
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
        line: claim.payoutInitiatedAt
          ? `Awaiting financial approval · payment in progress · ${formatDisplayDateTime(claim.payoutInitiatedAt)}`
          : "Awaiting financial approval · payment in progress",
        visual: "awaiting",
      },
    ];
  }

  return [
    uploaded,
    approvalDone,
    {
      key: "finance-waiting",
      line: "Awaiting financial approval · pending payment",
      visual: "awaiting",
    },
  ];
}

function lineStyles(visual: VisualState) {
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

function dotStyles(visual: VisualState) {
  switch (visual) {
    case "done":
      return "border-zinc-900 bg-zinc-900";
    case "awaiting":
      return "border-amber-500 bg-amber-500";
    case "upcoming":
      return "border-zinc-300 bg-zinc-200";
    case "rejected":
      return "border-red-600 bg-red-600";
  }
}

function connectorStyles(visual: VisualState) {
  return visual === "upcoming" ? "bg-zinc-200" : "bg-zinc-300";
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
                    "absolute top-2.5 left-[0.4375rem] h-[calc(100%-0.5rem)] w-0.5 -translate-x-1/2",
                    connectorStyles(step.visual),
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-10 mt-1 size-2 shrink-0 rounded-full border-2",
                  dotStyles(step.visual),
                )}
              />
              <p
                className={cn(
                  "min-w-0 flex-1 pt-0.5 text-sm leading-snug tabular-nums",
                  lineStyles(step.visual),
                )}
              >
                {step.line}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
