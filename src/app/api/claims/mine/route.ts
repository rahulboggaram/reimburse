import { prisma } from "@/lib/db";
import { requireOwnClaimsAccess } from "@/lib/auth-api";
import {
  claimsForEmployeeWhere,
  ownClaimsOnly,
} from "@/lib/claim-access";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import { claimNeedsPayoutSync, queuePayoutSync } from "@/lib/payouts";

export async function GET() {
  const session = await requireOwnClaimsAccess();
  if (session instanceof Response) return session;

  const ownerId = session.id;

  const claims = await prisma.reimbursement.findMany({
    where: claimsForEmployeeWhere(ownerId),
    orderBy: { createdAt: "desc" },
    include: claimListInclude,
  });

  queuePayoutSync(claims.filter(claimNeedsPayoutSync).map((c) => c.id));

  return Response.json(ownClaimsOnly(claims, ownerId).map(serializeClaimListItem), {
    headers: { "Cache-Control": "private, max-age=15" },
  });
}
