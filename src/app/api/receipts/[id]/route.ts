import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { apiDbErrorResponse } from "@/lib/api-db-error";
import { canViewClaimReceipts } from "@/lib/receipt-access";
import { isDatabaseReceiptPath, isSupabaseReceiptPath } from "@/lib/receipt-store";
import { receiptFileResponse } from "@/lib/receipt-content";
import { withDbRetry } from "@/lib/db-retry";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const session = await requireSession();
    if (session instanceof Response) return session;

    const receipt = await withDbRetry(() =>
      prisma.reimbursementReceipt.findUnique({
        where: { id },
        include: {
          reimbursement: {
            select: {
              id: true,
              employeeId: true,
              approverId: true,
              employee: { select: { role: true } },
            },
          },
        },
      }),
    );

    if (!receipt?.reimbursement) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    if (!canViewClaimReceipts(session, receipt.reimbursement)) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    const row = {
      id: receipt.id,
      filePath: receipt.filePath?.trim() ?? "",
      fileName: receipt.fileName,
      mimeType: receipt.mimeType,
      sizeBytes: receipt.sizeBytes,
    };

    if (!row.filePath) {
      return Response.json(
        { error: "This receipt has no file on record. Refile with a new photo." },
        { status: 404 },
      );
    }

    if (
      !isDatabaseReceiptPath(row.filePath) &&
      !isSupabaseReceiptPath(row.filePath) &&
      !row.filePath.startsWith("/uploads/")
    ) {
      return Response.json(
        { error: "This receipt is no longer available. Refile with a new photo." },
        { status: 404 },
      );
    }

    return receiptFileResponse(row.filePath, row.mimeType, row.fileName, row.sizeBytes);
  } catch (err) {
    return apiDbErrorResponse(
      "receipts/[id]",
      err,
      "Receipt unavailable. Please try again.",
    );
  }
}
