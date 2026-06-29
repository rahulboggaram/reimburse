import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { canViewClaimReceipts } from "@/lib/receipt-access";
import {
  loadReceiptPhotoBytes,
  serveReceiptImage,
} from "@/lib/receipt-photos";
import { withDbRetry } from "@/lib/db-retry";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const session = await requireSession();
    if (session instanceof Response) return session;

    const receipt = await withDbRetry(() =>
      prisma.reimbursementReceipt.findUnique({
        where: { id },
        include: {
          reimbursement: {
            select: {
              employeeId: true,
              approverId: true,
              employee: { select: { role: true } },
            },
          },
        },
      }),
    );

    if (!receipt?.reimbursement) {
      return Response.json({ error: "Receipt not found." }, { status: 404 });
    }

    if (!canViewClaimReceipts(session, receipt.reimbursement)) {
      return Response.json({ error: "Receipt not found." }, { status: 404 });
    }

    const bytes = await loadReceiptPhotoBytes({
      filePath: receipt.filePath,
      fileName: receipt.fileName,
      mimeType: receipt.mimeType,
      sizeBytes: receipt.sizeBytes,
    });

    return serveReceiptImage(bytes, receipt.mimeType, receipt.fileName);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load this receipt photo.";
    console.error("receipts/[id] failed", { id, err });
    return Response.json({ error: message }, { status: 404 });
  }
}
