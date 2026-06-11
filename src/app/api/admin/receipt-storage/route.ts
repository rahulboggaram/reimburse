import { requireAdminAccess } from "@/lib/auth-api";
import { prisma } from "@/lib/db";
import { countReceiptFilesInBlob } from "@/lib/receipt-blob";
import {
  cleanupLegacyBlobStorage,
  getReceiptStorageStats,
} from "@/lib/receipt-store";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const stats = await getReceiptStorageStats();
  const blobFilesRemaining = await countReceiptFilesInBlob();

  const recentReceipts = await prisma.reimbursementReceipt.findMany({
    where: { filePath: { startsWith: "data:" } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      fileName: true,
      filePath: true,
      reimbursement: {
        select: { employeeName: true, amount: true },
      },
    },
  });

  return Response.json({
    stats,
    blobFilesRemaining,
    recentReceipts: recentReceipts.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      fileName: row.fileName,
      employeeName: row.reimbursement.employeeName,
      amount: Number(row.reimbursement.amount),
      storage: "database" as const,
    })),
  });
}

export async function POST() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const result = await cleanupLegacyBlobStorage();
  const stats = await getReceiptStorageStats();
  const blobFilesRemaining = await countReceiptFilesInBlob();

  return Response.json({
    ok: !result.purgeError && result.migrateFailed === 0,
    ...result,
    stats,
    blobFilesRemaining,
  });
}
