import type { Prisma } from "@prisma/client";

export const FAILED_PAYOUT_STATUSES = [
  "failed",
  "rejected",
  "cancelled",
  "reversed",
] as const;

function approverAssigned(sessionId: string) {
  return {
    paymentApproverId: sessionId,
    employeeId: { not: sessionId },
  };
}

/** Payment approver queue — approved, not yet sent to Razorpay (or payout failed). */
export function approverPaymentWaitingWhere(
  sessionId: string,
): Prisma.ReimbursementWhereInput {
  return {
    AND: [
      approverAssigned(sessionId),
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

/** Payment approver sent to RazorpayX — in progress or completed. */
export function approverPaymentSentWhere(
  sessionId: string,
): Prisma.ReimbursementWhereInput {
  return {
    AND: [
      approverAssigned(sessionId),
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
