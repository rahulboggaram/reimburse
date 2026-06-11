import { prisma } from "@/lib/db";
import { requireOwnClaimsAccess } from "@/lib/auth-api";
import {
  claimsForEmployeeWhere,
  ownClaimsOnly,
} from "@/lib/claim-access";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import { claimNeedsPayoutSync, queuePayoutSync } from "@/lib/payouts";

export async function GET() {
  try {
    const session = await requireOwnClaimsAccess();
    if (session instanceof Response) return session;

    const ownerId = session.id;

    const claims = await prisma.reimbursement.findMany({
      where: {
        ...claimsForEmployeeWhere(ownerId),
        status: { not: "REJECTED" },
      },
      orderBy: { createdAt: "desc" },
      include: claimListInclude,
    });

    queuePayoutSync(claims.filter(claimNeedsPayoutSync).map((c) => c.id));

    return Response.json(ownClaimsOnly(claims, ownerId).map(serializeClaimListItem), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    console.error("claims/mine failed", err);
    return Response.json(
      { error: "Could not load your claims. Please try again." },
      { status: 500 },
    );
  }
}
