import { requireAdminAccess } from "@/lib/auth-api";
import { prisma } from "@/lib/db";
import {
  countReceiptFilesInBlob,
  isReceiptBlobPath,
  probeReceiptBlobStorage,
  readReceiptBlob,
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
    isReceiptBlobPath(row.filePath),
  ).length;
  const databaseCount = recentReceipts.filter((row) =>
    row.filePath.startsWith("data:"),
  ).length;

  const latestBlobReceipt = recentReceipts.find((row) =>
    isReceiptBlobPath(row.filePath),
  );
  let latestBlobRead: { ok: boolean; bytes?: number; error?: string } | null =
    null;
  if (latestBlobReceipt) {
    try {
      const bytes = await readReceiptBlob(latestBlobReceipt.filePath);
      latestBlobRead = bytes
        ? { ok: true, bytes: bytes.buffer.length }
        : { ok: false, error: "readReceiptBlob returned empty" };
    } catch (err) {
      latestBlobRead = {
        ok: false,
        error: err instanceof Error ? err.message : "read failed",
      };
    }
  }

  const storageMode = !env.runningOnVercel
    ? "local-files"
    : receiptBlobStorageEnabled() && probe?.ok
      ? "blob"
      : receiptBlobStorageEnabled()
        ? "blob-misconfigured"
        : "database-fallback";

  const blobFilesInStorage = await countReceiptFilesInBlob();
  const totalReceiptRows = await prisma.reimbursementReceipt.count();
  const blobLinkedRows = await prisma.reimbursementReceipt.count({
    where: {
      OR: [
        { filePath: { startsWith: "blob:" } },
        { filePath: { contains: ".blob.vercel-storage.com/" } },
        { filePath: { startsWith: "https://" } },
      ],
    },
  });

  const flowChecks = [
    {
      id: "vercel",
      label: "App is running on Vercel",
      ok: env.runningOnVercel,
      fix: "Deploy the reimburse project to Vercel (not local dev).",
    },
    {
      id: "credentials",
      label: "Blob credentials on this live deployment",
      ok: env.enabled,
      fix: "Vercel → Storage → reimburse-receipts → Connect to reimburse project, then redeploy Production.",
    },
    {
      id: "probe",
      label: "App can upload and read from Blob",
      ok: Boolean(probe?.ok),
      fix: probe?.error
        ? `Upload test failed: ${probe.error}. Redeploy after connecting the store.`
        : "Connect the Blob store and redeploy Production.",
    },
    {
      id: "read",
      label: "Latest Blob receipt can be read back",
      ok: latestBlobRead ? latestBlobRead.ok : blobLinkedRows === 0,
      fix: "Submit a new test claim with a photo after Blob is connected.",
    },
    {
      id: "new-claims",
      label: "Recent claims save to Blob (not database)",
      ok: blobCount > 0 && databaseCount === 0,
      fix:
        blobCount === 0 && databaseCount > 0
          ? "Old claims used database storage. Submit a NEW claim after Blob is fixed."
          : "Submit a test claim with a receipt photo.",
    },
  ];

  const allFlowOk = flowChecks.every((check) => check.ok);

  return Response.json({
    storageMode,
    connected: storageMode === "blob" && allFlowOk,
    env,
    probe,
    latestBlobRead,
    blobFilesInStorage,
    totalReceiptRows,
    blobLinkedRows,
    flowChecks,
    latestReceiptViewUrl: latestBlobReceipt
      ? `/api/receipts/${latestBlobReceipt.id}`
      : null,
    recentReceipts: recentReceipts.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      fileName: row.fileName,
      employeeName: row.reimbursement.employeeName,
      amount: Number(row.reimbursement.amount),
      storage: isReceiptBlobPath(row.filePath)
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
