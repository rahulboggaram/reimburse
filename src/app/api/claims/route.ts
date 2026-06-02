import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";
import { parseClaimFieldsFromFormData } from "@/lib/claim-form";
import { claimInclude, serializeClaim } from "@/lib/claims";
import { replaceClaimReceipts } from "@/lib/attach-receipts";
import { receiptFilesFromFormData } from "@/lib/receipt-files";

export async function POST(request: Request) {
  try {
    const session = await requireCanSubmitReimbursement();
    if (session instanceof Response) return session;

    const formData = await request.formData();
    const body = parseClaimFieldsFromFormData(formData);
    if (!body) {
      return Response.json({ error: "Invalid claim details" }, { status: 400 });
    }

    const receiptFiles = receiptFilesFromFormData(formData);

    const branch = await prisma.branch.findFirst({
      where: { id: body.branchId, active: true },
    });
    if (!branch) {
      return Response.json({ error: "Invalid branch" }, { status: 400 });
    }

    const branchManager = await prisma.user.findFirst({
      where: { role: "BRANCH_MANAGER", active: true, branchId: branch.id },
      orderBy: { createdAt: "asc" },
    });
    if (!branchManager) {
      return Response.json(
        { error: "No branch manager assigned for this branch yet." },
        { status: 400 },
      );
    }

    const paymentApprover = await prisma.user.findFirst({
      where: { role: "APPROVER", active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!paymentApprover) {
      return Response.json(
        { error: "No payment approver assigned yet." },
        { status: 400 },
      );
    }

    const category = await prisma.expenseCategory.findFirst({
      where: { name: body.category, active: true },
    });
    if (!category) {
      return Response.json({ error: "Invalid category" }, { status: 400 });
    }

    const employee = await prisma.user.findUniqueOrThrow({
      where: { id: session.id },
    });

    const claim = await prisma.reimbursement.create({
      data: {
        employeeId: session.id,
        employeeName: employee.name ?? "Employee",
        amount: body.amount,
        branchId: branch.id,
        category: body.category,
        description: body.description,
        expenseDate: new Date(),
        approverId: branchManager.id,
        paymentApproverId: paymentApprover.id,
      },
    });

    const receiptError = await replaceClaimReceipts(claim.id, receiptFiles);
    if (receiptError) {
      await prisma.reimbursement.delete({ where: { id: claim.id } });
      return receiptError;
    }

    const fullClaim = await prisma.reimbursement.findUniqueOrThrow({
      where: { id: claim.id },
      include: claimInclude,
    });

    return Response.json(serializeClaim(fullClaim), { status: 201 });
  } catch (err) {
    console.error("create-claim failed", err);
    return Response.json(
      { error: "Server error while saving reimbursement. Please try again." },
      { status: 500 },
    );
  }
}
