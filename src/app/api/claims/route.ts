import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireCanSubmitReimbursement } from "@/lib/auth-api";
import { parseClaimFieldsFromFormData } from "@/lib/claim-form";
import { readClientSubmitId } from "@/lib/claim-submit-form";
import { resolveClaimBranchForUser } from "@/lib/claim-branch";
import { resolveClaimRouting } from "@/lib/claim-routing";
import { createReimbursementWithReceipts } from "@/lib/attach-receipts";
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

function serializeSavedReceipts(
  receipts: Array<{ id: string; fileName: string | null; mimeType: string }>,
) {
  return receipts.map((receipt) => ({
    id: receipt.id,
    fileName: receipt.fileName,
    mimeType: receipt.mimeType,
    url: receiptClientUrl(receipt),
  }));
}

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

    const clientSubmitId = readClientSubmitId(formData);

    const receiptFiles = receiptFilesFromFormData(formData);
    const receiptValidationError = validateReceiptFiles(receiptFiles);
    if (receiptValidationError) {
      return Response.json({ error: receiptValidationError }, { status: 400 });
    }

    if (clientSubmitId) {
      const existing = await withDbRetry(() =>
        prisma.reimbursement.findUnique({
          where: { clientSubmitId },
          select: {
            id: true,
            employeeId: true,
            receipts: {
              select: { id: true, fileName: true, mimeType: true },
              orderBy: { createdAt: "asc" },
            },
          },
        }),
      );

      if (existing) {
        if (existing.employeeId !== session.id) {
          return Response.json({ error: "Submit id already used." }, { status: 409 });
        }
        return Response.json(
          {
            id: existing.id,
            recovered: true,
            receipts: serializeSavedReceipts(existing.receipts),
          },
          { status: 200 },
        );
      }
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

    const created = await withDbRetry(() =>
      createReimbursementWithReceipts({
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
        clientSubmitId,
        receiptInputs,
      }),
    );

    if ("error" in created) {
      return Response.json({ error: created.error }, { status: 400 });
    }

    const claim = created.claim;

    if (session.role === "ADMIN") {
      const claimId = claim.id;
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

    const savedReceipts = await withDbRetry(() =>
      prisma.reimbursementReceipt.findMany({
        where: { reimbursementId: claim.id },
        select: { id: true, fileName: true, mimeType: true },
        orderBy: { createdAt: "asc" },
      }),
    );

    return Response.json(
      {
        id: claim.id,
        receipts: serializeSavedReceipts(savedReceipts),
      },
      { status: 201 },
    );
  } catch (err) {
    return apiDbErrorResponse(
      "create-claim",
      err,
      "Server error while saving reimbursement. Please try again.",
    );
  }
}
