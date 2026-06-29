import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { apiDbErrorResponse } from "@/lib/api-db-error";
import { canViewClaimReceipts } from "@/lib/receipt-access";
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

    return receiptFileResponse({
      filePath: receipt.filePath?.trim() ?? "",
      fileData: receipt.fileData,
      fileName: receipt.fileName,
      mimeType: receipt.mimeType,
      sizeBytes: receipt.sizeBytes,
    });
  } catch (err) {
    return apiDbErrorResponse(
      "receipts/[id]",
      err,
      "Receipt unavailable. Please try again.",
    );
  }
}
