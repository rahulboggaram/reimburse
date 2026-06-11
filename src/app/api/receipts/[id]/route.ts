import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { canViewClaimReceipts } from "@/lib/receipt-access";
import { resolveReceiptBlobPath } from "@/lib/receipt-blob";
import { receiptFileResponse } from "@/lib/receipt-content";

export const maxDuration = 30;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const session = await requireSession();
    if (session instanceof Response) return session;

    const receipt = await prisma.reimbursementReceipt.findUnique({
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
    });

    if (!receipt) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    if (!canViewClaimReceipts(session, receipt.reimbursement)) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    let filePath = receipt.filePath;
    const resolved = await resolveReceiptBlobPath(
      filePath,
      receipt.reimbursement.id,
    );
    if (resolved && resolved !== filePath) {
      filePath = resolved;
      await prisma.reimbursementReceipt.update({
        where: { id: receipt.id },
        data: { filePath: resolved },
      });
    }

    const response = await receiptFileResponse(
      filePath,
      receipt.mimeType,
      receipt.fileName,
    );
    if (response.status >= 400) {
      console.error("receipt GET miss", {
        receiptId: id,
        filePathPrefix: receipt.filePath.slice(0, 60),
        sizeBytes: receipt.sizeBytes,
      });
    }
    return response;
  } catch (err) {
    console.error("receipt GET failed", err);
    return Response.json({ error: "Receipt unavailable" }, { status: 500 });
  }
}
