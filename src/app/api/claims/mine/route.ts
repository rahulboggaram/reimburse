import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import {
  claimNeedsPayoutSync,
  refreshPayoutsFromRazorpay,
} from "@/lib/payouts";

export async function GET() {
  const session = await requireCanSubmitReimbursement();
  if (session instanceof Response) return session;

  const claims = await prisma.reimbursement.findMany({
    where: { employeeId: session.id },
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
          where: { employeeId: session.id },
          orderBy: { createdAt: "desc" },
          include: claimListInclude,
        })
      : claims;

  return Response.json(fresh.map(serializeClaimListItem), {
    headers: { "Cache-Control": "private, no-cache" },
  });
}
