import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireManagerAccess } from "@/lib/auth-api";
import {
  claimPendingListInclude,
  serializeClaimPendingListItem,
} from "@/lib/claims";
import { adminApprovalQueueWhere } from "@/lib/claim-decide-access";
import {
  adminSelfServiceFailedCandidatesWhere,
  adminSelfServiceSentWhere,
  approverPaymentFailedCandidatesWhere,
  approverPaymentSentWhere,
  approverPaymentWaitingWhere,
  filterQueueClaimsForTab,
  orgPaymentWaitingWhere,
} from "@/lib/claim-payment-queue";
import { withDbRetry } from "@/lib/db-retry";
import { claimNeedsPayoutSync, queuePayoutSync } from "@/lib/payouts";

type QueueTab = "waiting" | "approved" | "failed";

const LIST_LIMIT = 300;

function parseQueueTab(param: string | null): QueueTab {
  if (param === "approved") return "approved";
  if (param === "failed") return "failed";
  return "waiting";
}

function queueWhere(
  session: { id: string; role: string; branchId?: string | null },
  tab: QueueTab,
): Prisma.ReimbursementWhereInput {
  if (tab === "failed") {
    if (session.role === "APPROVER") {
      return approverPaymentFailedCandidatesWhere(session.id);
    }
    if (session.role === "ADMIN") {
      return adminSelfServiceFailedCandidatesWhere(session.id);
    }
    return { id: "__none__" };
  }

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
          adminApprovalQueueWhere(),
          orgPaymentWaitingWhere(session.branchId),
        ],
      };
    }
    return adminSelfServiceSentWhere(session.id);
  }

  return tab === "waiting"
    ? { status: "PENDING" }
    : { status: { in: ["APPROVED", "PAID"] } };
}

function queueOrderBy(
  session: { role: string },
  tab: QueueTab,
): Prisma.ReimbursementOrderByWithRelationInput[] {
  if (tab === "approved" || tab === "failed") {
    // Match the Date column (expense date) so rows never look out of order.
    return [{ expenseDate: "desc" }, { createdAt: "desc" }];
  }
  if (session.role === "APPROVER") {
    return [{ decidedAt: "desc" }, { createdAt: "desc" }];
  }
  return [{ createdAt: "desc" }];
}

export async function GET(request: Request) {
  try {
    const session = await requireManagerAccess();
    if (session instanceof Response) return session;

    const tabParam = new URL(request.url).searchParams.get("tab");
    const tab = parseQueueTab(tabParam);

    const claims = await withDbRetry(() =>
      prisma.reimbursement.findMany({
        where: queueWhere(session, tab),
        orderBy: queueOrderBy(session, tab),
        take: LIST_LIMIT,
        include: claimPendingListInclude,
      }),
    );

    const filtered = filterQueueClaimsForTab(claims, tab);

    queuePayoutSync(filtered.filter(claimNeedsPayoutSync).map((c) => c.id));

    const serialized = filtered.flatMap((claim) => {
      try {
        return [serializeClaimPendingListItem(claim)];
      } catch (rowErr) {
        console.error("claims/pending serialize failed", claim.id, rowErr);
        return [];
      }
    });

    return Response.json(serialized, {
      headers: { "Cache-Control": "private, max-age=20" },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("claims/pending failed", {
      detail,
      role: "see session in prior log",
      err,
    });
    return Response.json(
      { error: "Could not load approvals. Please refresh and try again." },
      { status: 500 },
    );
  }
}
