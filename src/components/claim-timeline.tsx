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
  subtitle?: string;
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
    title: "Uploaded by",
    subtitle: `${who} · ${formatDisplayDateTime(claim.createdAt)}`,
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
        subtitle: claim.decidedAt
          ? `${manager} · ${formatDisplayDateTime(claim.decidedAt)}`
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
        title: "Awaiting approval",
        subtitle: `from ${manager}`,
        visual: "awaiting",
      },
      {
        key: "finance-next",
        title: "Financial approval",
        subtitle: "Up next",
        visual: "upcoming",
      },
    ];
  }

  const approvalDone: TimelineStep = {
    key: "approval-done",
    title: "Approved",
    subtitle: claim.decidedAt
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
        subtitle: formatDisplayDateTime(claim.paidAt),
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
        subtitle: claim.payoutInitiatedAt
          ? `Payment in progress · ${formatDisplayDateTime(claim.payoutInitiatedAt)}`
          : "Payment in progress",
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
      subtitle: "Pending payment",
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
      return "text-red-800";
  }
}

function subtitleStyles(visual: VisualState) {
  switch (visual) {
    case "done":
      return "text-zinc-600";
    case "awaiting":
      return "text-amber-700/90";
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

function lineStyles(visual: VisualState) {
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
            <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3 left-[0.4375rem] h-[calc(100%-0.75rem)] w-0.5 -translate-x-1/2",
                    lineStyles(step.visual),
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-10 mt-0.5 size-2.5 shrink-0 rounded-full border-2",
                  dotStyles(step.visual),
                )}
              />
              <div className="min-w-0 flex-1 pt-px">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    titleStyles(step.visual),
                  )}
                >
                  {step.title}
                </p>
                {step.subtitle ? (
                  <p
                    className={cn(
                      "mt-0.5 text-sm tabular-nums",
                      subtitleStyles(step.visual),
                    )}
                  >
                    {step.subtitle}
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
