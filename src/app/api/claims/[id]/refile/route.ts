import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";
import { parseClaimFieldsFromFormData } from "@/lib/claim-form";
import { resolveClaimBranchForUser } from "@/lib/claim-branch";
import { resolveClaimRouting } from "@/lib/claim-routing";
import { replaceClaimReceiptsFromInputs } from "@/lib/attach-receipts";
import { tryAutoPayAdminClaim } from "@/lib/admin-auto-payout";
import { readReceiptInputs } from "@/lib/receipt-input";
import { receiptClientUrl } from "@/lib/receipt-url";
import { apiDbErrorResponse } from "@/lib/api-db-error";
import { withDbRetry } from "@/lib/db-retry";
import {
  receiptFilesFromFormData,
  validateReceiptFiles,
} from "@/lib/receipt-files";

export const maxDuration = 60;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
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

    const receiptError = await withDbRetry(() =>
      replaceClaimReceiptsFromInputs(id, receiptInputs),
    );
    if (receiptError) {
      return Response.json({ error: receiptError }, { status: 400 });
    }

    if (session.role === "ADMIN") {
      const claimId = id;
      const actorId = session.id;
      after(async () => {
        const payoutResult = await tryAutoPayAdminClaim(claimId, actorId);
        if (!payoutResult.ok && "error" in payoutResult) {
          console.error("background admin payout failed", {
            claimId,
            error: payoutResult.error,
          });
        }
      });
    }

    const savedReceipts = await prisma.reimbursementReceipt.findMany({
      where: { reimbursementId: id },
      select: { id: true, fileName: true, mimeType: true },
      orderBy: { createdAt: "asc" },
    });

    return Response.json({
      id,
      receipts: savedReceipts.map((receipt) => ({
        id: receipt.id,
        fileName: receipt.fileName,
        mimeType: receipt.mimeType,
        url: receiptClientUrl(receipt),
      })),
    });
  } catch (err) {
    return apiDbErrorResponse(
      "refile-claim",
      err,
      "Server error while saving reimbursement. Please try again.",
    );
  }
}
