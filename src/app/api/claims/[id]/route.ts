import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { deleteReceiptFilesForClaim } from "@/lib/receipt-files";
import {
  syncClaimReceiptsFromBlob,
  upgradeReceiptsToPublicUrls,
} from "@/lib/receipt-blob";
import { canPaymentApproverAccessClaim } from "@/lib/payment-approver";
import {
  canAccessAdminPortal,
  canAccessManagerPortal,
} from "@/lib/session";

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
  const isAdmin = canAccessAdminPortal(session);
  const isBranchManager =
    canAccessManagerPortal(session) && claim.approverId === session.id;
  const isPaymentApprover =
    canAccessManagerPortal(session) &&
    canPaymentApproverAccessClaim(session, claim);
  const isAssignedApprover = isBranchManager || isPaymentApprover;

  if (
    !canAccessAdminPortal(session) &&
    !canAccessManagerPortal(session) &&
    !isOwner
  ) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  if (!isOwner && !isAssignedApprover && !isAdmin) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }

  if (claim.receipts.length === 0) {
    await syncClaimReceiptsFromBlob(id).catch((error) => {
      console.error("sync claim receipts from blob failed", { claimId: id, error });
    });
  }

  let fresh =
    claim.receipts.length === 0
      ? await prisma.reimbursement.findUnique({
          where: { id },
          include: claimInclude,
        })
      : claim;

  const claimForResponse = fresh ?? claim;
  if (claimForResponse.receipts.length > 0) {
    await upgradeReceiptsToPublicUrls(id, claimForResponse.receipts).catch(
      (error) => {
        console.error("upgrade receipts to public failed", { claimId: id, error });
      },
    );
  }

  return Response.json(serializeClaim(claimForResponse), {
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
