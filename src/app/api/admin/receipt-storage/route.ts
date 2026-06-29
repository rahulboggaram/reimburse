import { requireAdminAccess } from "@/lib/auth-api";
import { prisma } from "@/lib/db";
import { loadReceiptPhotoBytes } from "@/lib/receipt-photos";
import { isDatabaseReceiptPath, isSupabaseReceiptPath } from "@/lib/receipt-store";
import { isSupabaseStorageEnabled } from "@/lib/supabase-storage";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const [total, inStorage, legacyText, localFiles] = await Promise.all([
    prisma.reimbursementReceipt.count(),
    prisma.reimbursementReceipt.count({
      where: {
        AND: [
          { NOT: { filePath: { startsWith: "data:" } } },
          { NOT: { filePath: { startsWith: "/uploads/" } } },
        ],
      },
    }),
    prisma.reimbursementReceipt.count({
      where: { filePath: { startsWith: "data:" } },
    }),
    prisma.reimbursementReceipt.count({
      where: { filePath: { startsWith: "/uploads/" } },
    }),
  ]);

  const recentReceipts = await prisma.reimbursementReceipt.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      filePath: true,
      reimbursement: { select: { employeeName: true, amount: true } },
    },
  });

  const probed = await Promise.all(
    recentReceipts.map(async (row) => {
      let previewOk = false;
      let previewError: string | null = null;
      try {
        const bytes = await loadReceiptPhotoBytes({
          filePath: row.filePath,
          fileName: row.fileName,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
        });
        previewOk = bytes.length > 0;
      } catch (err) {
        previewError =
          err instanceof Error ? err.message : "Could not load receipt bytes.";
      }

      const storage = isSupabaseReceiptPath(row.filePath)
        ? "supabase"
        : isDatabaseReceiptPath(row.filePath)
          ? "legacy-text"
          : row.filePath.startsWith("/uploads/")
            ? "local"
            : "unknown";

      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        fileName: row.fileName,
        employeeName: row.reimbursement.employeeName,
        amount: Number(row.reimbursement.amount),
        storage,
        previewOk,
        previewError,
      };
    }),
  );

  return Response.json({
    stats: {
      total,
      inStorage,
      legacyText,
      localFiles,
      storageConfigured: isSupabaseStorageEnabled(),
    },
    recentReceipts: probed,
  });
}
