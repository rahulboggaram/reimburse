import { prisma } from "@/lib/db";
import {
  deleteReceiptBlob,
  isReceiptBlobPath,
  readReceiptBlob,
} from "@/lib/receipt-blob";

/** Receipt image bytes live in the database as a data URL — simple and reliable. */
export function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function isDatabaseReceiptPath(filePath: string) {
  return filePath.startsWith("data:");
}

type ReceiptRow = {
  id: string;
  filePath: string;
  fileName: string | null;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Move legacy Blob receipts into the database so thumbnails always work.
 * Called when opening a claim detail view.
 */
export async function materializeReceiptsToDatabase(
  receipts: ReceiptRow[],
): Promise<void> {
  for (const receipt of receipts) {
    if (isDatabaseReceiptPath(receipt.filePath)) continue;
    if (!isReceiptBlobPath(receipt.filePath)) continue;

    const blob = await readReceiptBlob(receipt.filePath);
    if (!blob) {
      console.error("could not materialize blob receipt", {
        receiptId: receipt.id,
        filePathPrefix: receipt.filePath.slice(0, 80),
      });
      continue;
    }

    const dataUrl = bufferToDataUrl(blob.buffer, blob.mimeType || receipt.mimeType);
    const oldPath = receipt.filePath;

    await prisma.reimbursementReceipt.update({
      where: { id: receipt.id },
      data: {
        filePath: dataUrl,
        mimeType: blob.mimeType || receipt.mimeType,
        sizeBytes: blob.buffer.length,
      },
    });

    receipt.filePath = dataUrl;
    receipt.mimeType = blob.mimeType || receipt.mimeType;
    receipt.sizeBytes = blob.buffer.length;
    void deleteReceiptBlob(oldPath);
  }
}
