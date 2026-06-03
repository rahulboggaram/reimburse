import { prisma } from "@/lib/db";
import { requireEmployeeWithProfile } from "@/lib/auth-api";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";

/** Rejected reimbursements for the signed-in employee only (not visible to approvers/admins). */
export async function GET() {
  const session = await requireEmployeeWithProfile();
  if (session instanceof Response) return session;

  const claims = await prisma.reimbursement.findMany({
    where: { employeeId: session.id, status: "REJECTED" },
    orderBy: { decidedAt: "desc" },
    include: claimListInclude,
  });

  return Response.json(claims.map(serializeClaimListItem), {
    headers: { "Cache-Control": "private, no-cache" },
  });
}
