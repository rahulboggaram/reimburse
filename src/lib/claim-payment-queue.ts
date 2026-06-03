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
    ...approverAssigned(sessionId),
    status: "APPROVED",
    paidAt: null,
    OR: [
      { razorpayPayoutId: null },
      { payoutStatus: { in: [...FAILED_PAYOUT_STATUSES] } },
    ],
  };
}

/** All org reimbursements awaiting Razorpay payout (admin can pay any). */
export function orgPaymentWaitingWhere(): Prisma.ReimbursementWhereInput {
  return {
    status: "APPROVED",
    paidAt: null,
    OR: [
      { razorpayPayoutId: null },
      { payoutStatus: { in: [...FAILED_PAYOUT_STATUSES] } },
    ],
  };
}

export function paymentWaitingWhereForSession(session: {
  id: string;
  role: string;
}): Prisma.ReimbursementWhereInput | null {
  if (session.role === "APPROVER") {
    return approverPaymentWaitingWhere(session.id);
  }
  if (session.role === "ADMIN") {
    return orgPaymentWaitingWhere();
  }
  return null;
}

/** Payment approver sent to RazorpayX — in progress or completed. */
export function approverPaymentSentWhere(
  sessionId: string,
): Prisma.ReimbursementWhereInput {
  return {
    ...approverAssigned(sessionId),
    OR: [
      { status: "PAID" },
      {
        status: "APPROVED",
        razorpayPayoutId: { not: null },
        OR: [
          { payoutStatus: null },
          { payoutStatus: { notIn: [...FAILED_PAYOUT_STATUSES] } },
        ],
      },
    ],
  };
}
