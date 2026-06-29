import { requireAdminAccess } from "@/lib/auth-api";
import { prisma } from "@/lib/db";
import { getReceiptStorageStats } from "@/lib/receipt-store";
import { downloadReceiptObject } from "@/lib/supabase-storage";
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
        const response = await receiptFileResponse(
          row.filePath,
          row.mimeType,
          row.fileName,
          row.sizeBytes,
        );
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
        storage:
          row.filePath.startsWith("data:")
            ? "database"
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
