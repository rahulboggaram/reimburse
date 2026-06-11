import { requireAdminAccess } from "@/lib/auth-api";
import { prisma } from "@/lib/db";
import {
  probeReceiptBlobStorage,
  receiptBlobEnvStatus,
  receiptBlobStorageEnabled,
} from "@/lib/receipt-blob";

export async function GET() {
  const session = await requireAdminAccess();
  if (session instanceof Response) return session;

  const env = receiptBlobEnvStatus();
  const probe = env.enabled ? await probeReceiptBlobStorage() : null;

  const recentReceipts = await prisma.reimbursementReceipt.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
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

  const blobCount = recentReceipts.filter((row) =>
    row.filePath.startsWith("blob:"),
  ).length;
  const databaseCount = recentReceipts.filter((row) =>
    row.filePath.startsWith("data:"),
  ).length;

  const storageMode = !env.runningOnVercel
    ? "local-files"
    : receiptBlobStorageEnabled() && probe?.ok
      ? "blob"
      : receiptBlobStorageEnabled()
        ? "blob-misconfigured"
        : "database-fallback";

  return Response.json({
    storageMode,
    env,
    probe,
    recentReceipts: recentReceipts.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      fileName: row.fileName,
      employeeName: row.reimbursement.employeeName,
      amount: Number(row.reimbursement.amount),
      storage:
        row.filePath.startsWith("blob:")
          ? "blob"
          : row.filePath.startsWith("data:")
            ? "database"
            : row.filePath.startsWith("/uploads/")
              ? "local-file"
              : "unknown",
    })),
    summary: {
      recentSampleSize: recentReceipts.length,
      blobCount,
      databaseCount,
    },
    nextSteps:
      storageMode === "blob"
        ? [
            "Blob is working. Submit a new claim with a receipt, then refresh Storage → Browse — look under receipts/.",
          ]
        : storageMode === "database-fallback"
          ? [
              "If Storage already shows reimburse-receipts as Connected, skip reconnecting — go to Deployments.",
              "Deployments → latest Production deploy → ⋯ → Redeploy (required so env vars reach the live app).",
              "Optional check: Settings → Environment Variables — look for BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID.",
              "Refresh this page — “Blob credentials on this deployment” and “Test upload” should show ✓.",
              "Submit a NEW test claim with a receipt (old claims stay in the database, not Blob).",
            ]
          : storageMode === "blob-misconfigured"
            ? [
                "Blob env vars exist but the test upload failed — check the error above.",
                "Confirm the Blob store is linked to this project, then redeploy.",
              ]
            : ["Receipt storage runs from local files in development."],
  });
}
