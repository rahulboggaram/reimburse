import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireManagerAccess } from "@/lib/auth-api";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";

type QueueTab = "waiting" | "approved";

const failedPayoutStatuses = [
  "failed",
  "rejected",
  "cancelled",
  "reversed",
] as const;

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
    const assigned = {
      paymentApproverId: session.id,
      employeeId: { not: session.id },
    };
    if (tab === "waiting") {
      // Retry queue only — first-time and in-flight payouts live under Approved.
      return {
        ...assigned,
        status: "APPROVED",
        paidAt: null,
        payoutStatus: { in: [...failedPayoutStatuses] },
      };
    }
    // All branch-manager-approved claims (Queued) plus paid / payout in progress.
    return {
      ...assigned,
      status: { in: ["APPROVED", "PAID"] },
    };
  }

  if (session.role === "ADMIN") {
    if (tab === "waiting") {
      return { status: "PENDING" };
    }
    return { status: { in: ["APPROVED", "PAID"] } };
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
        ? [{ paidAt: "desc" as const }, { decidedAt: "desc" as const }]
        : { decidedAt: "desc" as const }
      : { createdAt: "desc" as const };

  const claims = await prisma.reimbursement.findMany({
    where,
    orderBy,
    include: claimListInclude,
  });

  return Response.json(claims.map(serializeClaimListItem));
}
