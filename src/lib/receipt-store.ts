import { prisma } from "@/lib/db";

/** Receipt image bytes live in the database as a data URL. */
export function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function isDatabaseReceiptPath(filePath: string) {
  return filePath.startsWith("data:");
}

export async function getReceiptStorageStats() {
  const [total, inDatabase, localFiles] = await Promise.all([
    prisma.reimbursementReceipt.count(),
    prisma.reimbursementReceipt.count({
      where: { filePath: { startsWith: "data:" } },
    }),
    prisma.reimbursementReceipt.count({
      where: { filePath: { startsWith: "/uploads/" } },
    }),
  ]);

  return {
    total,
    inDatabase,
    localFiles,
    unavailable: Math.max(0, total - inDatabase - localFiles),
  };
}
