import { prisma } from "@/lib/db";
import {
  deleteReceiptFilesForClaim,
  saveReceiptFiles,
  validateReceiptFiles,
} from "@/lib/receipt-files";

export async function replaceClaimReceipts(
  reimbursementId: string,
  files: File[],
): Promise<Response | null> {
  const validationError = validateReceiptFiles(files);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  await prisma.reimbursementReceipt.deleteMany({
    where: { reimbursementId },
  });
  await deleteReceiptFilesForClaim(reimbursementId);

  const saved = await saveReceiptFiles(reimbursementId, files);
  if (saved.length > 0) {
    await prisma.reimbursementReceipt.createMany({
      data: saved.map((file) => ({
        reimbursementId,
        filePath: file.filePath,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      })),
    });
  }

  return null;
}
