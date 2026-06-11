import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { canViewClaimReceipts } from "@/lib/receipt-access";
import { materializeReceiptsToDatabase } from "@/lib/receipt-store";
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

    await materializeReceiptsToDatabase([row]);

    return receiptFileResponse(row.filePath, row.mimeType, row.fileName);
  } catch (err) {
    console.error("receipt GET failed", err);
    return Response.json({ error: "Receipt unavailable" }, { status: 500 });
  }
}
