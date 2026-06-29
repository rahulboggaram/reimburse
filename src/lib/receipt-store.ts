import { prisma } from "@/lib/db";

/** Receipt bytes stored in the fileData column (not filePath). */
export const INLINE_RECEIPT_PATH = "db:inline";

export function isInlineReceiptPath(filePath: string) {
  return filePath.trim() === INLINE_RECEIPT_PATH;
}

/** Receipt image bytes live in the database as a data URL (legacy). */
export function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function isDatabaseReceiptPath(filePath: string) {
  return filePath.startsWith("data:");
}

/** Path inside the private Supabase `receipts` bucket, e.g. claimId/uuid.jpg */
export function isSupabaseReceiptPath(filePath: string) {
  const trimmed = filePath.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("/uploads/")) {
    return false;
  }
  return trimmed.includes("/");
}

export async function getReceiptStorageStats() {
  const [total, inBytes, inDatabase, inSupabaseStorage, localFiles] =
    await Promise.all([
      prisma.reimbursementReceipt.count(),
      prisma.reimbursementReceipt.count({
        where: { fileData: { not: null } },
      }),
      prisma.reimbursementReceipt.count({
        where: { filePath: { startsWith: "data:" } },
      }),
      prisma.reimbursementReceipt.count({
        where: {
          AND: [
            { fileData: null },
            { NOT: { filePath: { startsWith: "data:" } } },
            { NOT: { filePath: { startsWith: "/uploads/" } } },
            { NOT: { filePath: "db:inline" } },
          ],
        },
      }),
      prisma.reimbursementReceipt.count({
        where: { filePath: { startsWith: "/uploads/" } },
      }),
    ]);

  return {
    total,
    inBytes,
    inDatabase,
    inSupabaseStorage,
    localFiles,
    storageBackend: "database-bytes",
    unavailable: Math.max(0, total - inBytes - inDatabase - inSupabaseStorage - localFiles),
  };
}
