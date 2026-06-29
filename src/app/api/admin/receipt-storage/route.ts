import { requireAdminAccess } from "@/lib/auth-api";
import { prisma } from "@/lib/db";
import { getReceiptStorageStats, isInlineReceiptPath } from "@/lib/receipt-store";
import { receiptFileResponse } from "@/lib/receipt-content";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const stats = await getReceiptStorageStats();

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
      fileData: true,
      reimbursement: {
        select: { employeeName: true, amount: true },
      },
    },
  });

  const probed = await Promise.all(
    recentReceipts.map(async (row) => {
      let previewOk = false;
      let previewError: string | null = null;
      try {
        const response = await receiptFileResponse({
          filePath: row.filePath,
          fileData: row.fileData,
          mimeType: row.mimeType,
          fileName: row.fileName,
          sizeBytes: row.sizeBytes,
        });
        previewOk = response.ok;
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          previewError = body?.error ?? `HTTP ${response.status}`;
        }
      } catch (err) {
        previewError =
          err instanceof Error ? err.message : "Could not load receipt bytes.";
      }

      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        fileName: row.fileName,
        employeeName: row.reimbursement.employeeName,
        amount: Number(row.reimbursement.amount),
        storage: row.fileData
          ? "bytes"
          : row.filePath.startsWith("data:")
            ? "database"
            : isInlineReceiptPath(row.filePath)
              ? "bytes-missing"
              : row.filePath.startsWith("/uploads/")
                ? "local"
                : "supabase",
        previewOk,
        previewError,
      };
    }),
  );

  return Response.json({
    stats,
    recentReceipts: probed,
  });
}
