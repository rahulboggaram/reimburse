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
  branchId?: string | null,
): Prisma.ReimbursementWhereInput {
  return {
    ...approverAssigned(sessionId),
    ...(branchId ? { branchId } : {}),
    status: "APPROVED",
    paidAt: null,
    OR: [
      { razorpayPayoutId: null },
      { payoutStatus: { in: [...FAILED_PAYOUT_STATUSES] } },
    ],
  };
}

/** Reimbursements awaiting Razorpay payout (optionally scoped to one branch). */
export function orgPaymentWaitingWhere(
  branchId?: string | null,
): Prisma.ReimbursementWhereInput {
  return {
    status: "APPROVED",
    paidAt: null,
    ...(branchId ? { branchId } : {}),
    OR: [
      { razorpayPayoutId: null },
      { payoutStatus: { in: [...FAILED_PAYOUT_STATUSES] } },
    ],
  };
}

export function paymentWaitingWhereForSession(session: {
  id: string;
  role: string;
  branchId?: string | null;
}): Prisma.ReimbursementWhereInput | null {
  if (session.role === "APPROVER") {
    return approverPaymentWaitingWhere(session.id, session.branchId);
  }
  if (session.role === "ADMIN") {
    return orgPaymentWaitingWhere(session.branchId);
  }
  return null;
}

/** Payment approver sent to RazorpayX — in progress or completed. */
export function approverPaymentSentWhere(
  sessionId: string,
  branchId?: string | null,
): Prisma.ReimbursementWhereInput {
  return {
    ...approverAssigned(sessionId),
    ...(branchId ? { branchId } : {}),
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
