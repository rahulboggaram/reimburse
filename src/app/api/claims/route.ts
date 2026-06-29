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
import {
  receiptFilesFromFormData,
  validateReceiptFiles,
} from "@/lib/receipt-files";

export const maxDuration = 60;

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

    const receiptError = await replaceClaimReceiptsFromInputs(
      claim.id,
      receiptInputs,
    );
    if (receiptError) {
      await prisma.reimbursement.delete({ where: { id: claim.id } });
      return Response.json({ error: receiptError }, { status: 400 });
    }

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

    const savedReceipts = await prisma.reimbursementReceipt.findMany({
      where: { reimbursementId: claim.id },
      select: { id: true, fileName: true, mimeType: true },
      orderBy: { createdAt: "asc" },
    });

    return Response.json(
      {
        id: claim.id,
        receipts: savedReceipts.map((receipt) => ({
          id: receipt.id,
          fileName: receipt.fileName,
          mimeType: receipt.mimeType,
          url: receiptClientUrl(receipt),
        })),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("create-claim failed", err);
    const message =
      err instanceof Error && err.message.includes("too large")
        ? err.message
        : "Server error while saving reimbursement. Please try again.";
    return Response.json({ error: message }, { status: 500 });
  }
}
