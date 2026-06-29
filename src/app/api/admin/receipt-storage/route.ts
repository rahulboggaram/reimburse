import { requireAdminAccess } from "@/lib/auth-api";
import { prisma } from "@/lib/db";
import { getReceiptStorageStats } from "@/lib/receipt-store";

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
      filePath: true,
      reimbursement: {
        select: { employeeName: true, amount: true },
      },
    },
  });

  return Response.json({
    stats,
    recentReceipts: recentReceipts.map((row) => ({
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
    })),
  });
}
