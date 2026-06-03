import { prisma } from "@/lib/db";
import { requireEmployeeWithProfile } from "@/lib/auth-api";
import {
  assertClaimsBelongToEmployee,
  claimsForEmployeeWhere,
} from "@/lib/claim-access";
import { claimListInclude, serializeClaimListItem } from "@/lib/claims";

/** Rejected reimbursements for the signed-in employee only. */
export async function GET() {
  const session = await requireEmployeeWithProfile();
  if (session instanceof Response) return session;

  const claims = await prisma.reimbursement.findMany({
    where: { ...claimsForEmployeeWhere(session.id), status: "REJECTED" },
    orderBy: { decidedAt: "desc" },
    include: claimListInclude,
  });

  const owned = assertClaimsBelongToEmployee(claims, session.id);

  return Response.json(owned.map(serializeClaimListItem), {
    headers: { "Cache-Control": "private, no-cache" },
  });
}
