import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { canAccessManagerPortal } from "@/lib/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireSession();
  if (session instanceof Response) return session;

  const claim = await prisma.reimbursement.findUnique({
    where: { id },
    include: claimInclude,
  });

  if (!claim) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  const isOwner = claim.employeeId === session.id;
  const isAssignedApprover =
    canAccessManagerPortal(session) &&
    (claim.approverId === session.id || claim.paymentApproverId === session.id);

  if (!isOwner && !isAssignedApprover) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  return Response.json(serializeClaim(claim));
}
