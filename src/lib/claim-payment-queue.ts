import type { Prisma } from "@prisma/client";
import { paymentApproverClaimFilter } from "@/lib/payment-approver";

export const FAILED_PAYOUT_STATUSES = [
  "failed",
  "rejected",
  "cancelled",
  "reversed",
] as const;

/** Failed payout must fall within this window after approval (decidedAt). */
export const PAYMENT_FAILURE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

export function isPayoutFailed(status: string | null | undefined) {
  return (
    status != null &&
    (FAILED_PAYOUT_STATUSES as readonly string[]).includes(status)
  );
}

type PaymentFailureTiming = {
  decidedAt: Date | null;
  payoutStatus: string | null;
  paidAt: Date | null;
  status: string;
  updatedAt: Date;
  payoutInitiatedAt: Date | null;
};

/** Payment failed on approval day or within 2 days after approval. */
export function isRecentPaymentFailure(claim: PaymentFailureTiming) {
  if (claim.status === "PAID" || claim.paidAt) return false;
  if (!isPayoutFailed(claim.payoutStatus)) return false;
  if (!claim.decidedAt) return false;

  const approvalAt = claim.decidedAt.getTime();
  const failureAt = Math.max(
    claim.updatedAt.getTime(),
    claim.payoutInitiatedAt?.getTime() ?? 0,
  );
  if (failureAt < approvalAt) return false;
  return failureAt - approvalAt <= PAYMENT_FAILURE_WINDOW_MS;
}

export function filterQueueClaimsForTab<
  T extends PaymentFailureTiming,
>(claims: T[], tab: "waiting" | "approved" | "failed"): T[] {
  if (tab === "failed") {
    return claims.filter(isRecentPaymentFailure);
  }
  if (tab === "waiting") {
    return claims.filter((claim) => !isRecentPaymentFailure(claim));
  }
  return claims;
}

/** Payment approver queue — all approved branch claims except own and admin. */
export function approverPaymentWaitingWhere(
  sessionId: string,
): Prisma.ReimbursementWhereInput {
  return {
    AND: [
      paymentApproverClaimFilter(sessionId),
      { status: "APPROVED" },
      { paidAt: null },
      {
        OR: [
          { razorpayPayoutId: null },
          { payoutStatus: { in: [...FAILED_PAYOUT_STATUSES] } },
        ],
      },
    ],
  };
}

/**
 * Admin submit-and-pay claims skip branch approval and the manual payment queue.
 * They belong on the “Sent to Razorpay” tab only.
 */
function excludeAdminSubmitterFromPaymentQueue(): Prisma.ReimbursementWhereInput {
  return { employee: { role: { not: "ADMIN" } } };
}

/** Reimbursements awaiting Razorpay payout (optionally scoped to one branch). */
export function orgPaymentWaitingWhere(
  branchId?: string | null,
): Prisma.ReimbursementWhereInput {
  return {
    AND: [
      excludeAdminSubmitterFromPaymentQueue(),
      {
        status: "APPROVED",
        paidAt: null,
        ...(branchId ? { branchId } : {}),
        OR: [
          { razorpayPayoutId: null },
          { payoutStatus: { in: [...FAILED_PAYOUT_STATUSES] } },
        ],
      },
    ],
  };
}

export function paymentWaitingWhereForSession(session: {
  id: string;
  role: string;
  branchId?: string | null;
}): Prisma.ReimbursementWhereInput | null {
  if (session.role === "APPROVER") {
    return approverPaymentWaitingWhere(session.id);
  }
  if (session.role === "ADMIN") {
    return orgPaymentWaitingWhere(session.branchId);
  }
  return null;
}

/** Payment approver — Razorpay payout failed soon after approval. */
export function approverPaymentFailedCandidatesWhere(
  sessionId: string,
): Prisma.ReimbursementWhereInput {
  return {
    AND: [
      paymentApproverClaimFilter(sessionId),
      {
        status: "APPROVED",
        paidAt: null,
        decidedAt: { not: null },
        razorpayPayoutId: { not: null },
        payoutStatus: { in: [...FAILED_PAYOUT_STATUSES] },
      },
    ],
  };
}

/** Admin submit-and-pay claims with a recent Razorpay failure. */
export function adminSelfServiceFailedCandidatesWhere(
  adminId: string,
): Prisma.ReimbursementWhereInput {
  return {
    employeeId: adminId,
    approverId: adminId,
    paymentApproverId: adminId,
    status: "APPROVED",
    paidAt: null,
    decidedAt: { not: null },
    razorpayPayoutId: { not: null },
    payoutStatus: { in: [...FAILED_PAYOUT_STATUSES] },
  };
}

/** Payment approver sent to RazorpayX — in progress or completed. */
export function approverPaymentSentWhere(
  sessionId: string,
): Prisma.ReimbursementWhereInput {
  return {
    AND: [
      paymentApproverClaimFilter(sessionId),
      {
        OR: [
          { status: "PAID" },
          {
            AND: [
              { status: "APPROVED" },
              { razorpayPayoutId: { not: null } },
              {
                OR: [
                  { payoutStatus: null },
                  { payoutStatus: { notIn: [...FAILED_PAYOUT_STATUSES] } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

/** Admin’s own submit-and-pay claims — shown on “Sent to Razorpay”, not the payment queue. */
export function adminSelfServiceSentWhere(
  adminId: string,
): Prisma.ReimbursementWhereInput {
  return {
    employeeId: adminId,
    approverId: adminId,
    paymentApproverId: adminId,
    status: { in: ["APPROVED", "PAID"] },
  };
}
