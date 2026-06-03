import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireManagerAccess } from "@/lib/auth-api";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import { adminApprovalQueueWhere } from "@/lib/claim-decide-access";
import {
  countAdminPendingApproval,
  countPaymentWaiting,
} from "@/lib/bulk-claim-actions";
import {
  approverPaymentSentWhere,
  approverPaymentWaitingWhere,
} from "@/lib/claim-payment-queue";

type QueueTab = "waiting" | "approved";

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
      ? approverPaymentWaitingWhere(session.id)
      : approverPaymentSentWhere(session.id);
  }

  if (session.role === "ADMIN") {
    if (tab === "waiting") {
      return adminApprovalQueueWhere();
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

  const includeCounts = new URL(request.url).searchParams.get("counts") === "1";

  const [claims, paymentWaiting, adminPending] = await Promise.all([
    prisma.reimbursement.findMany({
      where,
      orderBy,
      include: claimListInclude,
    }),
    includeCounts &&
    (session.role === "ADMIN" || session.role === "APPROVER")
      ? countPaymentWaiting(session)
      : Promise.resolve(0),
    includeCounts && session.role === "ADMIN"
      ? countAdminPendingApproval()
      : Promise.resolve(0),
  ]);

  const body = includeCounts
    ? {
        claims: claims.map(serializeClaimListItem),
        counts: { paymentWaiting, adminPending },
      }
    : claims.map(serializeClaimListItem);

  return Response.json(body, {
    headers: { "Cache-Control": "private, max-age=20" },
  });
}
