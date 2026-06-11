import { prisma } from "@/lib/db";
import {
  deleteReceiptBlob,
  isReceiptBlobPath,
  purgeAllReceiptBlobsFromStore,
  readReceiptBlob,
} from "@/lib/receipt-blob";

/** Receipt image bytes live in the database as a data URL. */
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

/** Move every legacy Blob receipt row into the database. */
export async function materializeAllLegacyBlobReceipts(): Promise<{
  migrated: number;
  failed: number;
}> {
  const legacy = await prisma.reimbursementReceipt.findMany({
    where: {
      OR: [
        { filePath: { startsWith: "blob:" } },
        { filePath: { contains: ".blob.vercel-storage.com/" } },
      ],
    },
    select: {
      id: true,
      filePath: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
    },
  });

  let migrated = 0;
  let failed = 0;

  for (const receipt of legacy) {
    const before = receipt.filePath;
    await materializeReceiptsToDatabase([receipt]);
    if (isDatabaseReceiptPath(receipt.filePath)) {
      migrated += 1;
    } else {
      failed += 1;
      console.error("legacy blob receipt not migrated", {
        receiptId: receipt.id,
        filePathPrefix: before.slice(0, 80),
      });
    }
  }

  return { migrated, failed };
}

export async function getReceiptStorageStats() {
  const [total, inDatabase, legacyBlob, localFiles] = await Promise.all([
    prisma.reimbursementReceipt.count(),
    prisma.reimbursementReceipt.count({
      where: { filePath: { startsWith: "data:" } },
    }),
    prisma.reimbursementReceipt.count({
      where: {
        OR: [
          { filePath: { startsWith: "blob:" } },
          { filePath: { contains: ".blob.vercel-storage.com/" } },
        ],
      },
    }),
    prisma.reimbursementReceipt.count({
      where: { filePath: { startsWith: "/uploads/" } },
    }),
  ]);

  return { total, inDatabase, legacyBlob, localFiles };
}

export async function cleanupLegacyBlobStorage(): Promise<{
  migrated: number;
  migrateFailed: number;
  blobFilesDeleted: number;
  purgeError?: string;
}> {
  const { migrated, failed } = await materializeAllLegacyBlobReceipts();
  const purge = await purgeAllReceiptBlobsFromStore();
  return {
    migrated,
    migrateFailed: failed,
    blobFilesDeleted: purge.deleted,
    purgeError: purge.error,
  };
}
