import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { deleteReceiptFilesForClaim } from "@/lib/receipt-files";
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
  const isAdmin = session.role === "ADMIN";
  const isAssignedApprover =
    canAccessManagerPortal(session) &&
    (claim.approverId === session.id || claim.paymentApproverId === session.id);

  if (session.role === "EMPLOYEE" && !isOwner) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  if (!isOwner && !isAssignedApprover && !isAdmin) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  return Response.json(serializeClaim(claim), {
    headers: { "Cache-Control": "private, max-age=10" },
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireSession();
  if (session instanceof Response) return session;

  const claim = await prisma.reimbursement.findUnique({
    where: { id },
    select: { id: true, employeeId: true, status: true },
  });

  if (!claim || claim.employeeId !== session.id) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.status !== "REJECTED") {
    return Response.json(
      { error: "Only rejected reimbursements can be deleted." },
      { status: 409 },
    );
  }

  await deleteReceiptFilesForClaim(id);
  await prisma.reimbursement.delete({ where: { id } });

  return Response.json({ ok: true });
}
