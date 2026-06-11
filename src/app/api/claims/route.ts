import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";
import { parseClaimFieldsFromFormData } from "@/lib/claim-form";
import { resolveClaimBranchForUser } from "@/lib/claim-branch";
import { resolveClaimRouting } from "@/lib/claim-routing";
import { finalizeClaimInBackground } from "@/lib/attach-receipts";
import { readReceiptInputs } from "@/lib/receipt-input";
import {
  receiptFilesFromFormData,
  validateReceiptFiles,
} from "@/lib/receipt-files";

export async function POST(request: Request) {
  try {
    const session = await requireCanSubmitReimbursement();
    if (session instanceof Response) return session;

    const formData = await request.formData();
    const body = parseClaimFieldsFromFormData(formData);
    if (!body) {
      return Response.json(
        { error: "Invalid claim details. Amount must be at least ₹1." },
        { status: 400 },
      );
    }

    const receiptFiles = receiptFilesFromFormData(formData);
    const receiptValidationError = validateReceiptFiles(receiptFiles);
    if (receiptValidationError) {
      return Response.json({ error: receiptValidationError }, { status: 400 });
    }

    const branchResult = await resolveClaimBranchForUser(session.id);
    if ("error" in branchResult) {
      return Response.json({ error: branchResult.error }, { status: 400 });
    }

    const [category, routingResult, receiptInputs] = await Promise.all([
      prisma.expenseCategory.findFirst({
        where: { name: body.category, active: true },
      }),
      resolveClaimRouting(
        { id: session.id, role: session.role },
        branchResult.branchId,
      ),
      readReceiptInputs(receiptFiles),
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

    const claimId = claim.id;
    const adminActorId = session.role === "ADMIN" ? session.id : undefined;
    after(async () => {
      await finalizeClaimInBackground({
        claimId,
        receiptInputs,
        adminActorId,
      });
    });

    return Response.json({ id: claim.id }, { status: 201 });
  } catch (err) {
    console.error("create-claim failed", err);
    return Response.json(
      { error: "Server error while saving reimbursement. Please try again." },
      { status: 500 },
    );
  }
}
