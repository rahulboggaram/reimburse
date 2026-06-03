import { prisma } from "@/lib/db";
import { requireOwnClaimsAccess } from "@/lib/auth-api";
import { claimsForEmployeeWhere, ownClaimsOnly } from "@/lib/claim-access";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";

/** Rejected reimbursements for the signed-in employee only. */
export async function GET() {
  const session = await requireOwnClaimsAccess();
  if (session instanceof Response) return session;

  const ownerId = session.id;

  const claims = await prisma.reimbursement.findMany({
    where: { ...claimsForEmployeeWhere(ownerId), status: "REJECTED" },
    orderBy: { decidedAt: "desc" },
    include: claimListInclude,
  });

  return Response.json(ownClaimsOnly(claims, ownerId).map(serializeClaimListItem), {
    headers: { "Cache-Control": "private, no-cache" },
  });
}
