import { prisma } from "@/lib/db";
import { requireOwnClaimsAccess } from "@/lib/auth-api";
import {
  claimsForEmployeeWhere,
  ownClaimsOnly,
} from "@/lib/claim-access";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import {
  claimNeedsPayoutSync,
  refreshPayoutsFromRazorpay,
} from "@/lib/payouts";

export async function GET() {
  const session = await requireOwnClaimsAccess();
  if (session instanceof Response) return session;

  const ownerId = session.id;

  const claims = await prisma.reimbursement.findMany({
    where: claimsForEmployeeWhere(ownerId),
    orderBy: { createdAt: "desc" },
    include: claimListInclude,
  });

  const syncIds = claims.filter(claimNeedsPayoutSync).map((c) => c.id);
  if (syncIds.length > 0) {
    await refreshPayoutsFromRazorpay(syncIds);
  }

  const fresh =
    syncIds.length > 0
      ? await prisma.reimbursement.findMany({
          where: claimsForEmployeeWhere(ownerId),
          orderBy: { createdAt: "desc" },
          include: claimListInclude,
        })
      : claims;

  return Response.json(ownClaimsOnly(fresh, ownerId).map(serializeClaimListItem), {
    headers: { "Cache-Control": "private, no-cache" },
  });
}
