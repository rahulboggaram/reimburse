import { prisma } from "@/lib/db";
import { requireOwnClaimsAccess } from "@/lib/auth-api";
import { apiDbErrorResponse } from "@/lib/api-db-error";
import { claimsForEmployeeWhere, ownClaimsOnly } from "@/lib/claim-access";
import {
  claimEmployeeRejectedSelect,
  serializeClaimEmployeeRejectedItem,
} from "@/lib/claims";
import { withDbRetry } from "@/lib/db-retry";

const REJECTED_LIST_LIMIT = 50;

/** Rejected reimbursements for the signed-in employee only. */
export async function GET() {
  try {
    const session = await requireOwnClaimsAccess();
    if (session instanceof Response) return session;

    const ownerId = session.id;

    const claims = await withDbRetry(() =>
      prisma.reimbursement.findMany({
        where: { ...claimsForEmployeeWhere(ownerId), status: "REJECTED" },
        orderBy: { decidedAt: "desc" },
        take: REJECTED_LIST_LIMIT,
        select: claimEmployeeRejectedSelect,
      }),
    );

    return Response.json(
      ownClaimsOnly(claims, ownerId).map(serializeClaimEmployeeRejectedItem),
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    return apiDbErrorResponse(
      "claims/mine/rejected",
      err,
      "Could not load rejected claims. Please try again.",
    );
  }
}
