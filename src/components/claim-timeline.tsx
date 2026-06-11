"use client";

import type { SerializedClaim } from "@/lib/claim-types";
import {
  isAdminLedPayment,
  isAdminSelfServiceClaim,
  payoutInProgress,
} from "@/lib/claim-display-status";

function payoutFailed(status: string | null | undefined) {
  return (
    status === "failed" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "reversed"
  );
}

function formatRazorpayStatus(status: string | null | undefined) {
  if (!status) return null;
  return status.replace(/_/g, " ");
}

function paidSubtext(claim: SerializedClaim) {
  const when = formatDisplayDateTime(
    claim.paidAt ?? claim.payoutInitiatedAt ?? claim.updatedAt,
  );
  if (claim.payoutUtr?.trim()) {
    return `${claim.payoutUtr.trim()} · ${when}`;
  }
  return when;
}

function paidStep(claim: SerializedClaim): TimelineStep {
  const subtext = paidSubtext(claim);
  return {
    key: "paid",
    title: "Paid",
    subtext,
    visual: "done",
  };
}

function razorpayTimelineStep(claim: SerializedClaim): TimelineStep {
  const status = formatRazorpayStatus(claim.payoutStatus);
  const subtextParts: string[] = [];
  if (claim.payoutInitiatedAt) {
    subtextParts.push(formatDisplayDateTime(claim.payoutInitiatedAt));
  }
  if (claim.payoutError?.trim()) {
    subtextParts.push(claim.payoutError.trim());
  }
  if (payoutFailed(claim.payoutStatus)) {
    return {
      key: "razorpay-failed",
      title: status ? `Razorpay · ${status}` : "Payment failed",
      subtext:
        subtextParts.length > 0 ? subtextParts.join(" · ") : undefined,
      visual: "rejected",
    };
  }

  return {
    key: "razorpay-processing",
    title: status ? `Razorpay · ${status}` : "Payment processing",
    subtext:
      subtextParts.length > 0 ? subtextParts.join(" · ") : "Sent to RazorpayX",
    visual: "awaiting",
  };
}
import { TimelineCheckMark } from "@/components/timeline-check-mark";
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

function approvalWaitingSubtext(claim: SerializedClaim) {
  if (claim.approver?.role === "ADMIN") {
    return "approval by Admin";
  }
  return `approval by ${branchManagerLabel(claim)}`;
}

function paymentApproverLabel(claim: SerializedClaim) {
  return personLabel(claim.paymentApprover?.name, "payment approver");
}

function payoutComplete(claim: SerializedClaim) {
  return claim.status === "PAID" || Boolean(claim.paidAt);
}

function payoutStarted(claim: SerializedClaim) {
  return Boolean(
    claim.payoutInitiatedAt || claim.paidAt || claim.razorpayPayoutId,
  );
}

function adminApprovalStep(claim: SerializedClaim): TimelineStep {
  const at = claim.decidedAt ?? claim.createdAt;
  return {
    key: "approval-done",
    title: "Approved",
    subtext: `Auto-approved · ${formatDisplayDateTime(at)}`,
    visual: "done",
  };
}

function branchApprovalStep(claim: SerializedClaim): TimelineStep {
  const manager = branchManagerLabel(claim);
  return {
    key: "approval-done",
    title: "Approved",
    subtext: claim.decidedAt
      ? `by ${manager} · ${formatDisplayDateTime(claim.decidedAt)}`
      : `by ${manager}`,
    visual: "done",
  };
}

function adminPaymentSteps(claim: SerializedClaim): TimelineStep[] {
  if (payoutComplete(claim)) {
    return [paidStep(claim)];
  }

  if (payoutStarted(claim)) {
    if (payoutInProgress(claim.payoutStatus) || payoutFailed(claim.payoutStatus)) {
      return [razorpayTimelineStep(claim)];
    }
  }

  return [
    {
      key: "payment-waiting",
      title: "Awaiting payment",
      subtext: "Sending to your bank account",
      visual: "awaiting",
    },
  ];
}

function approverPaymentSteps(claim: SerializedClaim): TimelineStep[] {
  const who = paymentApproverLabel(claim);
  const initiatedAt = claim.payoutInitiatedAt ?? claim.paidAt;

  if (!payoutStarted(claim)) {
    return [
      {
        key: "finance-waiting",
        title: "Awaiting financial approval",
        subtext: `by ${who}`,
        visual: "awaiting",
      },
    ];
  }

  const financeDone: TimelineStep = {
    key: "finance-done",
    title: "Financial approval",
    subtext: initiatedAt
      ? `by ${who} · ${formatDisplayDateTime(initiatedAt)}`
      : `by ${who}`,
    visual: "done",
  };

  if (payoutComplete(claim)) {
    return [financeDone, paidStep(claim)];
  }

  if (payoutStarted(claim)) {
    return [financeDone, razorpayTimelineStep(claim)];
  }

  return [financeDone];
}

function buildTimelineSteps(claim: SerializedClaim): TimelineStep[] {
  const uploaded = uploadedStep(claim);
  const adminSelf = isAdminSelfServiceClaim(claim);

  if (claim.status === "REJECTED") {
    const manager = branchManagerLabel(claim);
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
    const approverSubmitted = claim.employee?.role === "APPROVER";
    return [
      uploaded,
      {
        key: "approval-waiting",
        title: "Awaiting",
        subtext: approvalWaitingSubtext(claim),
        visual: "awaiting",
      },
      approverSubmitted
        ? {
            key: "finance-next",
            title: "Awaiting financial approval",
            subtext: "by Admin",
            visual: "upcoming",
          }
        : {
            key: "finance-next",
            title: "Awaiting financial approval",
            subtext: `by ${paymentApproverLabel(claim)}`,
            visual: "upcoming",
          },
    ];
  }

  const approvalDone = adminSelf
    ? adminApprovalStep(claim)
    : branchApprovalStep(claim);

  const paymentSteps = isAdminLedPayment(claim)
    ? adminPaymentSteps(claim)
    : approverPaymentSteps(claim);

  return [uploaded, approvalDone, ...paymentSteps];
}

/** Matches Queued status badges (accent soft / accent). */
const AWAITING_COLOR = "text-accent";
const UPCOMING_COLOR = "text-zinc-400";

function titleStyles(visual: VisualState) {
  switch (visual) {
    case "done":
      return "text-zinc-900";
    case "awaiting":
      return AWAITING_COLOR;
    case "upcoming":
      return UPCOMING_COLOR;
    case "rejected":
      return "text-red-700";
  }
}

function subtextStyles(visual: VisualState) {
  switch (visual) {
    case "done":
      return "text-zinc-500";
    case "awaiting":
      return AWAITING_COLOR;
    case "upcoming":
      return UPCOMING_COLOR;
    case "rejected":
      return "text-red-600/80";
  }
}

const DOT_SIZE = "size-6";
const DOT_CENTER = "left-3";

function connectorStyles(
  visual: VisualState,
  nextVisual: VisualState | undefined,
) {
  if (visual === "done") return "bg-zinc-900";
  if (nextVisual === "upcoming") return "bg-zinc-400";
  return "bg-zinc-200";
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
        <TimelineCheckMark className="size-4.5" />
      </span>
    );
  }

  if (props.visual === "rejected") {
    return (
      <span aria-hidden className={cn(base, "border-2 border-red-600 bg-red-600")} />
    );
  }

  if (props.visual === "awaiting") {
    return (
      <span
        aria-hidden
        className={cn(base, "border-2 border-accent bg-accent")}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(base, "border-2 border-zinc-400 bg-zinc-400")}
    />
  );
}

export function ClaimTimeline(props: { claim: SerializedClaim }) {
  const steps = buildTimelineSteps(props.claim);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 py-4">
      <ol className="space-y-0 px-3">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const nextStep = steps[index + 1];

          return (
            <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-6 h-[calc(100%-0.875rem)] w-0.5 -translate-x-1/2",
                    DOT_CENTER,
                    connectorStyles(step.visual, nextStep?.visual),
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
