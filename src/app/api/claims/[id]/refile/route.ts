import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";
import { parseClaimFieldsFromFormData } from "@/lib/claim-form";
import { resolveClaimBranchId } from "@/lib/claim-branch";
import { resolveClaimRouting } from "@/lib/claim-routing";
import { tryAutoPayAdminClaim } from "@/lib/admin-auto-payout";
import { replaceClaimReceipts } from "@/lib/attach-receipts";
import { receiptFilesFromFormData } from "@/lib/receipt-files";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await requireCanSubmitReimbursement();
  if (session instanceof Response) return session;

  const formData = await request.formData();
  const body = parseClaimFieldsFromFormData(formData);
  if (!body) {
    return Response.json({ error: "Invalid claim details" }, { status: 400 });
  }

  const receiptFiles = receiptFilesFromFormData(formData);

  const existing = await prisma.reimbursement.findUnique({ where: { id } });
  if (!existing || existing.employeeId !== session.id) {
    return Response.json({ error: "Claim not found" }, { status: 404 });
  }
  if (existing.status !== "REJECTED") {
    return Response.json(
      { error: "Only rejected claims can be refiled." },
      { status: 409 },
    );
  }

  const branchResult = await resolveClaimBranchId(body.branchId);
  if ("error" in branchResult) {
    return Response.json({ error: branchResult.error }, { status: 400 });
  }

  const [category, routingResult] = await Promise.all([
    prisma.expenseCategory.findFirst({
      where: { name: body.category, active: true },
    }),
    resolveClaimRouting(
      { id: session.id, role: session.role },
      branchResult.branchId,
    ),
  ]);
  if (!category) {
    return Response.json({ error: "Invalid category" }, { status: 400 });
  }
  if ("error" in routingResult) {
    return Response.json({ error: routingResult.error }, { status: 400 });
  }
  const { routing } = routingResult;

  await prisma.reimbursement.update({
    where: { id },
    data: {
      employeeName: session.name ?? existing.employeeName,
      amount: body.amount,
      branchId: branchResult.branchId,
      category: body.category,
      description: body.description,
      approverId: routing.approverId,
      paymentApproverId: routing.paymentApproverId,
      status: routing.status,
      rejectionReason: null,
      decidedAt: routing.decidedAt,
      refiledFromId: existing.refiledFromId ?? existing.id,
    },
  });

  const receiptError = await replaceClaimReceipts(id, receiptFiles);
  if (receiptError) return receiptError;

  let payoutWarning: string | undefined;
  if (session.role === "ADMIN") {
    const payoutResult = await tryAutoPayAdminClaim(id, session.id);
    if (!payoutResult.ok && "error" in payoutResult) {
      payoutWarning = payoutResult.error;
    }
  }

  return Response.json({ id, payoutWarning });
}
