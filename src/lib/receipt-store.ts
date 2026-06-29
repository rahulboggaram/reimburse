import { prisma } from "@/lib/db";
import { isSupabaseStorageEnabled } from "@/lib/supabase-storage";

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
  const [total, inDatabase, inSupabaseStorage, localFiles] = await Promise.all([
    prisma.reimbursementReceipt.count(),
    prisma.reimbursementReceipt.count({
      where: { filePath: { startsWith: "data:" } },
    }),
    prisma.reimbursementReceipt.count({
      where: {
        AND: [
          { NOT: { filePath: { startsWith: "data:" } } },
          { NOT: { filePath: { startsWith: "/uploads/" } } },
        ],
      },
    }),
    prisma.reimbursementReceipt.count({
      where: { filePath: { startsWith: "/uploads/" } },
    }),
  ]);

  return {
    total,
    inDatabase,
    inSupabaseStorage,
    localFiles,
    storageBackend: isSupabaseStorageEnabled() ? "supabase" : "database",
    unavailable: Math.max(0, total - inDatabase - inSupabaseStorage - localFiles),
  };
}
