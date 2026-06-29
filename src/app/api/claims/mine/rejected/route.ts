import { prisma } from "@/lib/db";
import { requireOwnClaimsAccess } from "@/lib/auth-api";
import { apiDbErrorResponse } from "@/lib/api-db-error";
import { claimsForEmployeeWhere, ownClaimsOnly } from "@/lib/claim-access";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import { withDbRetry } from "@/lib/db-retry";

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
        include: claimListInclude,
      }),
    );

    return Response.json(ownClaimsOnly(claims, ownerId).map(serializeClaimListItem), {
      headers: { "Cache-Control": "private, no-cache" },
    });
  } catch (err) {
    return apiDbErrorResponse(
      "claims/mine/rejected",
      err,
      "Could not load rejected claims. Please try again.",
    );
  }
}
