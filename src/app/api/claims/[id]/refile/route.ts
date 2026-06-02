import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";
import { parseClaimFieldsFromFormData } from "@/lib/claim-form";
import { resolveClaimRouting } from "@/lib/claim-routing";
import { claimInclude, serializeClaim } from "@/lib/claims";
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

  const branch = await prisma.branch.findFirst({
    where: { id: body.branchId, active: true },
  });
  if (!branch) {
    return Response.json({ error: "Invalid branch" }, { status: 400 });
  }

  const routingResult = await resolveClaimRouting(
    { id: session.id, role: session.role },
    branch.id,
  );
  if ("error" in routingResult) {
    return Response.json({ error: routingResult.error }, { status: 400 });
  }
  const { routing } = routingResult;

  const category = await prisma.expenseCategory.findFirst({
    where: { name: body.category, active: true },
  });
  if (!category) {
    return Response.json({ error: "Invalid category" }, { status: 400 });
  }

  const employee = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
  });

  await prisma.reimbursement.update({
    where: { id },
    data: {
      employeeName: employee.name ?? existing.employeeName,
      amount: body.amount,
      branchId: branch.id,
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

  if (session.role === "ADMIN") {
    await tryAutoPayAdminClaim(id, session.id);
  }

  const claim = await prisma.reimbursement.findUniqueOrThrow({
    where: { id },
    include: claimInclude,
  });

  return Response.json(serializeClaim(claim));
}
