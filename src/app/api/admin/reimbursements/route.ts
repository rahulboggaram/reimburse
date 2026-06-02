import { prisma } from "@/lib/db";
import { requireAdminAccess } from "@/lib/auth-api";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";

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

  return Response.json(
    claims.map((claim) => ({
      ...serializeClaimListItem(claim),
      employee: claim.employee,
    })),
  );
}
