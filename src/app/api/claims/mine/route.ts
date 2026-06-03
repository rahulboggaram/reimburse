import { prisma } from "@/lib/db";
import { requireOwnClaimsAccess } from "@/lib/auth-api";
import { assertClaimsBelongToEmployee, claimsForEmployeeWhere } from "@/lib/claim-access";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import {
  claimNeedsPayoutSync,
  refreshPayoutsFromRazorpay,
} from "@/lib/payouts";

export async function GET() {
  const session = await requireOwnClaimsAccess();
  if (session instanceof Response) return session;

  const claims = await prisma.reimbursement.findMany({
    where: claimsForEmployeeWhere(session.id),
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
          where: claimsForEmployeeWhere(session.id),
          orderBy: { createdAt: "desc" },
          include: claimListInclude,
        })
      : claims;

  const owned = assertClaimsBelongToEmployee(fresh, session.id);

  return Response.json(owned.map(serializeClaimListItem), {
    headers: { "Cache-Control": "private, no-cache" },
  });
}
