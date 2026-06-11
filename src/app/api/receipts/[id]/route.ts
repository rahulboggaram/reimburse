import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { canViewClaimReceipts } from "@/lib/receipt-access";
import {
  isReceiptBlobPath,
  readReceiptBlob,
  resolveReceiptBlobPath,
} from "@/lib/receipt-blob";
import { receiptFileResponse, serveReceiptBytes } from "@/lib/receipt-content";

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

    if (!receipt.reimbursement) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    if (!canViewClaimReceipts(session, receipt.reimbursement)) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    let filePath = receipt.filePath?.trim() ?? "";
    if (!filePath) {
      return Response.json(
        { error: "This receipt has no file on record. Refile with a new photo." },
        { status: 404 },
      );
    }

    if (isReceiptBlobPath(filePath)) {
      let blob = await readReceiptBlob(filePath);

      if (!blob) {
        const resolved = await resolveReceiptBlobPath(
          filePath,
          receipt.reimbursement.id,
        );
        if (resolved) {
          filePath = resolved;
          if (resolved !== receipt.filePath) {
            await prisma.reimbursementReceipt.update({
              where: { id: receipt.id },
              data: { filePath: resolved },
            });
          }
          blob = await readReceiptBlob(filePath);
        }
      }

      if (blob) {
        return serveReceiptBytes(
          blob.buffer,
          blob.mimeType || receipt.mimeType,
          receipt.fileName,
        );
      }

      console.error("receipt GET blob miss", {
        receiptId: id,
        filePathPrefix: filePath.slice(0, 80),
        sizeBytes: receipt.sizeBytes,
      });
      return Response.json(
        {
          error:
            "Receipt file is missing from storage. Submit a new claim with the photo, or refile this one.",
        },
        { status: 404 },
      );
    }

    return receiptFileResponse(filePath, receipt.mimeType, receipt.fileName);
  } catch (err) {
    console.error("receipt GET failed", err);
    return Response.json({ error: "Receipt unavailable" }, { status: 500 });
  }
}
