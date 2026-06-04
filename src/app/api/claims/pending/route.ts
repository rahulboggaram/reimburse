import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireManagerAccess } from "@/lib/auth-api";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import { adminApprovalQueueWhere } from "@/lib/claim-decide-access";
import {
  approverPaymentSentWhere,
  approverPaymentWaitingWhere,
  orgPaymentWaitingWhere,
} from "@/lib/claim-payment-queue";

type QueueTab = "waiting" | "approved";

function queueWhere(
  session: { id: string; role: string; branchId?: string | null },
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
      return {
        OR: [
          adminApprovalQueueWhere(session.branchId),
          orgPaymentWaitingWhere(session.branchId),
        ],
      };
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

function queueOrderBy(
  session: { role: string },
  tab: QueueTab,
): Prisma.ReimbursementOrderByWithRelationInput {
  if (tab === "approved") {
    return session.role === "APPROVER"
      ? { payoutInitiatedAt: "desc" }
      : { decidedAt: "desc" };
  }
  return session.role === "APPROVER"
    ? { decidedAt: "desc" }
    : { createdAt: "desc" };
}

async function fetchQueueClaims(
  session: { id: string; role: string; branchId?: string | null },
  tab: QueueTab,
) {
  const orderBy = queueOrderBy(session, tab);

  return prisma.reimbursement.findMany({
    where: queueWhere(session, tab),
    orderBy,
    include: claimListInclude,
  });
}

export async function GET(request: Request) {
  try {
    const session = await requireManagerAccess();
    if (session instanceof Response) return session;

    const tabParam = new URL(request.url).searchParams.get("tab");
    const tab: QueueTab = tabParam === "approved" ? "approved" : "waiting";
    const claims = await fetchQueueClaims(session, tab);

    return Response.json(claims.map(serializeClaimListItem), {
      headers: { "Cache-Control": "private, max-age=20" },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("claims/pending failed", detail, err);
    return Response.json(
      { error: "Could not load approvals. Please refresh and try again." },
      { status: 500 },
    );
  }
}
