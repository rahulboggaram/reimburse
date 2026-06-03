import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireManagerAccess } from "@/lib/auth-api";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import {
  claimNeedsPayoutSync,
  refreshPayoutsFromRazorpay,
} from "@/lib/payouts";

type QueueTab = "waiting" | "approved";

const failedPayoutStatuses = [
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

/** Branch manager approved — payment approver has not sent to RazorpayX yet (or payout failed). */
function approverWaitingWhere(sessionId: string): Prisma.ReimbursementWhereInput {
  return {
    ...approverAssigned(sessionId),
    status: "APPROVED",
    paidAt: null,
    OR: [
      { razorpayPayoutId: null },
      { payoutStatus: { in: [...failedPayoutStatuses] } },
    ],
  };
}

/** Payment approver sent to RazorpayX — in progress or completed. */
function approverApprovedWhere(sessionId: string): Prisma.ReimbursementWhereInput {
  return {
    ...approverAssigned(sessionId),
    OR: [
      { status: "PAID" },
      {
        status: "APPROVED",
        razorpayPayoutId: { not: null },
        OR: [
          { payoutStatus: null },
          { payoutStatus: { notIn: [...failedPayoutStatuses] } },
        ],
      },
    ],
  };
}

function queueWhere(
  session: { id: string; role: string },
  tab: QueueTab,
): Prisma.ReimbursementWhereInput {
  if (session.role === "BRANCH_MANAGER") {
    if (tab === "waiting") {
      return { status: "PENDING", approverId: session.id };
    }
    return {
      approverId: session.id,
      status: { in: ["APPROVED", "PAID"] },
    };
  }

  if (session.role === "APPROVER") {
    return tab === "waiting"
      ? approverWaitingWhere(session.id)
      : approverApprovedWhere(session.id);
  }

  if (session.role === "ADMIN") {
    if (tab === "waiting") {
      return { status: "PENDING", approverId: session.id };
    }
    return {
      approverId: session.id,
      status: { in: ["APPROVED", "PAID"] },
    };
  }

  return tab === "waiting"
    ? { status: "PENDING" }
    : { status: { in: ["APPROVED", "PAID"] } };
}

export async function GET(request: Request) {
  const session = await requireManagerAccess();
  if (session instanceof Response) return session;

  const tabParam = new URL(request.url).searchParams.get("tab");
  const tab: QueueTab = tabParam === "approved" ? "approved" : "waiting";
  const where = queueWhere(session, tab);
  const orderBy =
    tab === "approved"
      ? session.role === "APPROVER"
        ? { payoutInitiatedAt: "desc" as const }
        : { decidedAt: "desc" as const }
      : session.role === "APPROVER"
        ? { decidedAt: "desc" as const }
        : { createdAt: "desc" as const };

  const claims = await prisma.reimbursement.findMany({
    where,
    orderBy,
    include: claimListInclude,
  });

  const syncIds = claims.filter(claimNeedsPayoutSync).map((c) => c.id);
  if (syncIds.length > 0) {
    await refreshPayoutsFromRazorpay(syncIds);
  }

  const fresh =
    syncIds.length > 0
      ? await prisma.reimbursement.findMany({
          where,
          orderBy,
          include: claimListInclude,
        })
      : claims;

  return Response.json(fresh.map(serializeClaimListItem), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
