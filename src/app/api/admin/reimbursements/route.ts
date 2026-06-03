import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";
import {
  claimNeedsPayoutSync,
  refreshPayoutsFromRazorpay,
} from "@/lib/payouts";

export async function GET(request: Request) {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");

  const claims = await prisma.reimbursement.findMany({
    where: employeeId ? { employeeId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      ...claimListInclude,
      employee: {
        select: { id: true, name: true, phone: true },
      },
    },
  });

  const syncIds = claims.filter(claimNeedsPayoutSync).map((c) => c.id);
  if (syncIds.length > 0) {
    await refreshPayoutsFromRazorpay(syncIds);
  }

  const fresh =
    syncIds.length > 0
      ? await prisma.reimbursement.findMany({
          where: employeeId ? { employeeId } : undefined,
          orderBy: { createdAt: "desc" },
          include: {
            ...claimListInclude,
            employee: {
              select: { id: true, name: true, phone: true },
            },
          },
        })
      : claims;

  return Response.json(
    fresh.map((claim) => ({
      ...serializeClaimListItem(claim),
      employee: claim.employee,
    })),
  );
}
