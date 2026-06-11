import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { canViewClaimReceipts } from "@/lib/receipt-access";
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

    return await receiptFileResponse(
      receipt.filePath,
      receipt.mimeType,
      receipt.fileName,
    );
  } catch (err) {
    console.error("receipt GET failed", err);
    return Response.json({ error: "Receipt unavailable" }, { status: 500 });
  }
}
