import type { Prisma } from "@prisma/client";
import { payoutInProgress } from "@/lib/claim-display-status";
import { paymentApproverClaimFilter } from "@/lib/payment-approver";

export const FAILED_PAYOUT_STATUSES = [
  "failed",
  "rejected",
  "cancelled",
  "reversed",
] as const;

/** After this long, an in-progress payout is treated as stuck (not completed). */
export const ACTIVE_PAYOUT_GRACE_MS = 2 * 60 * 60 * 1000;

export function isPayoutFailed(status: string | null | undefined) {
  return (
    status != null &&
    (FAILED_PAYOUT_STATUSES as readonly string[]).includes(status)
  );
}

type FailedPaymentsClaim = {
  status: string;
  paidAt: Date | null;
  payoutStatus: string | null;
  razorpayPayoutId: string | null;
  payoutInitiatedAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
};

function wasSentToRazorpay(claim: FailedPaymentsClaim) {
  return Boolean(claim.razorpayPayoutId || claim.payoutInitiatedAt);
}

function lastPayoutActivityAt(claim: FailedPaymentsClaim) {
  if (claim.payoutInitiatedAt) return claim.payoutInitiatedAt.getTime();
  if (claim.decidedAt) return claim.decidedAt.getTime();
  return claim.createdAt.getTime();
}

/** Unpaid claim sent to Razorpay that failed or never finished paying out. */
export function belongsInFailedPaymentsTab(claim: FailedPaymentsClaim) {
  if (claim.status === "PAID" || claim.paidAt) return false;
  if (claim.status !== "APPROVED") return false;
  if (!wasSentToRazorpay(claim)) return false;

  if (isPayoutFailed(claim.payoutStatus)) return true;

  const elapsed = Date.now() - lastPayoutActivityAt(claim);
  if (elapsed <= ACTIVE_PAYOUT_GRACE_MS) return false;

  if (payoutInProgress(claim.payoutStatus) || !claim.payoutStatus) {
    return true;
  }

  return false;
}

/** @deprecated Use belongsInFailedPaymentsTab */
export function isRecentPaymentFailure(claim: FailedPaymentsClaim) {
  return belongsInFailedPaymentsTab(claim);
}

export function filterQueueClaimsForTab<
  T extends FailedPaymentsClaim,
>(claims: T[], tab: "waiting" | "approved" | "failed"): T[] {
  if (tab === "failed") {
    return claims.filter(belongsInFailedPaymentsTab);
  }
  if (tab === "waiting" || tab === "approved") {
    return claims.filter((claim) => !belongsInFailedPaymentsTab(claim));
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

/** Payment approver — sent to Razorpay but unpaid (failed or stuck). */
export function approverPaymentFailedCandidatesWhere(
  sessionId: string,
): Prisma.ReimbursementWhereInput {
  return {
    AND: [
      paymentApproverClaimFilter(sessionId),
      {
        status: "APPROVED",
        paidAt: null,
        OR: [
          { razorpayPayoutId: { not: null } },
          { payoutInitiatedAt: { not: null } },
        ],
      },
    ],
  };
}

/** Admin submit-and-pay claims sent to Razorpay but unpaid. */
export function adminSelfServiceFailedCandidatesWhere(
  adminId: string,
): Prisma.ReimbursementWhereInput {
  return {
    employeeId: adminId,
    approverId: adminId,
    paymentApproverId: adminId,
    status: "APPROVED",
    paidAt: null,
    OR: [
      { razorpayPayoutId: { not: null } },
      { payoutInitiatedAt: { not: null } },
    ],
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
