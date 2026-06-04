import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";
import { parseClaimFieldsFromFormData } from "@/lib/claim-form";
import { resolveClaimBranchForUser } from "@/lib/claim-branch";
import { resolveClaimRouting } from "@/lib/claim-routing";
import { tryAutoPayAdminClaim } from "@/lib/admin-auto-payout";
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

    const branchResult = await resolveClaimBranchForUser(session.id);
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

    const claim = await prisma.reimbursement.create({
      data: {
        employeeId: session.id,
        employeeName: session.name ?? "Employee",
        amount: body.amount,
        branchId: branchResult.branchId,
        category: body.category,
        description: body.description,
        expenseDate: new Date(),
        approverId: routing.approverId,
        paymentApproverId: routing.paymentApproverId,
        status: routing.status,
        decidedAt: routing.decidedAt,
      },
    });

    const receiptError = await replaceClaimReceipts(claim.id, receiptFiles);
    if (receiptError) {
      await prisma.reimbursement.delete({ where: { id: claim.id } });
      return receiptError;
    }

    let payoutWarning: string | undefined;
    if (session.role === "ADMIN") {
      const payoutResult = await tryAutoPayAdminClaim(claim.id, session.id);
      if (!payoutResult.ok && "error" in payoutResult) {
        payoutWarning = payoutResult.error;
      }
    }

    return Response.json({ id: claim.id, payoutWarning }, { status: 201 });
  } catch (err) {
    console.error("create-claim failed", err);
    return Response.json(
      { error: "Server error while saving reimbursement. Please try again." },
      { status: 500 },
    );
  }
}
