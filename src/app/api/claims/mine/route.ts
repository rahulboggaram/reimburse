import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireOwnClaimsAccess } from "@/lib/auth-api";
import { apiDbErrorResponse } from "@/lib/api-db-error";
import {
  claimsForEmployeeWhere,
  ownClaimsOnly,
} from "@/lib/claim-access";
import {
  claimEmployeeMineSelect,
  serializeClaimEmployeeMineItem,
} from "@/lib/claims";
import { withDbRetry } from "@/lib/db-retry";
import { claimNeedsPayoutSync, queuePayoutSync } from "@/lib/payouts";

const MINE_LIST_LIMIT = 200;

export async function GET() {
  try {
    const session = await requireOwnClaimsAccess();
    if (session instanceof Response) return session;

    const ownerId = session.id;

    const claims = await withDbRetry(() =>
      prisma.reimbursement.findMany({
        where: {
          ...claimsForEmployeeWhere(ownerId),
          status: { not: "REJECTED" },
        },
        orderBy: { createdAt: "desc" },
        take: MINE_LIST_LIMIT,
        select: claimEmployeeMineSelect,
      }),
    );

    const payoutIds = claims.filter(claimNeedsPayoutSync).map((c) => c.id);
    if (payoutIds.length > 0) {
      after(() => {
        queuePayoutSync(payoutIds);
      });
    }

    return Response.json(
      ownClaimsOnly(claims, ownerId).map(serializeClaimEmployeeMineItem),
      {
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    return apiDbErrorResponse(
      "claims/mine",
      err,
      "Could not load your claims. Please try again.",
    );
  }
}
