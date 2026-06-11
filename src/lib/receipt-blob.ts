import { del, get, head, list, put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

const BLOB_PREFIX = "blob:";

/** True when Vercel Blob is linked to this project (token or OIDC store id). */
export function receiptBlobStorageEnabled() {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  if (process.env.VERCEL && process.env.BLOB_STORE_ID?.trim()) return true;
  return false;
}

function blobConnectionOptions() {
  const options: {
    token?: string;
    storeId?: string;
  } = {};
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (token) options.token = token;
  if (storeId) options.storeId = storeId;
  return options;
}

function putOptions(contentType: string) {
  return {
    access: "private" as const,
    contentType,
    ...blobConnectionOptions(),
  };
}

function getOptions() {
  return {
    access: "private" as const,
    useCache: false as const,
    ...blobConnectionOptions(),
  };
}

function listOptions() {
  return blobConnectionOptions();
}

function sanitizeFileName(fileName: string) {
  const base = fileName.replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "receipt";
}

export function isReceiptBlobPath(filePath: string) {
  return (
    filePath.startsWith(BLOB_PREFIX) ||
    filePath.includes(".blob.vercel-storage.com/")
  );
}

function pathnameFromBlobReference(filePath: string): string | null {
  if (filePath.startsWith(BLOB_PREFIX)) {
    return filePath.slice(BLOB_PREFIX.length);
  }
  try {
    const url = new URL(filePath);
    if (!url.hostname.endsWith(".blob.vercel-storage.com")) return null;
    const pathname = url.pathname.startsWith("/")
      ? url.pathname.slice(1)
      : url.pathname;
    return pathname || null;
  } catch {
    return null;
  }
}

/** Candidates to pass to @vercel/blob get() — full URL and pathname variants. */
export function blobGetTargets(filePath: string): string[] {
  if (!filePath?.trim()) return [];

  const targets: string[] = [];
  const add = (value: string | null | undefined) => {
    if (!value) return;
    if (!targets.includes(value)) targets.push(value);
  };

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    add(filePath);
    add(pathnameFromBlobReference(filePath));
    return targets;
  }

  if (filePath.startsWith(BLOB_PREFIX)) {
    const pathname = filePath.slice(BLOB_PREFIX.length);
    add(pathname);
    return targets;
  }

  if (filePath.includes(".blob.vercel-storage.com/")) {
    add(filePath);
    add(pathnameFromBlobReference(filePath));
  }

  return targets;
}

export function blobGetTarget(filePath: string): string | null {
  return blobGetTargets(filePath)[0] ?? null;
}

export type OpenedReceiptBlob = {
  stream: ReadableStream<Uint8Array>;
  mimeType: string;
  sizeBytes: number | null;
};

/** Stream a private blob (preferred for serving — avoids buffering issues on Vercel). */
export async function openReceiptBlobStream(
  filePath: string,
): Promise<OpenedReceiptBlob | null> {
  const targets = blobGetTargets(filePath);
  if (targets.length === 0) return null;

  for (const target of targets) {
    try {
      const result = await get(target, getOptions());
      if (!result || result.statusCode !== 200 || !result.stream) continue;
      return {
        stream: result.stream,
        mimeType: result.blob.contentType || "application/octet-stream",
        sizeBytes: result.blob.size ?? null,
      };
    } catch (err) {
      console.error("receipt blob stream open failed", {
        filePath: filePath.slice(0, 80),
        target: target.slice(0, 120),
        err,
      });
    }
  }
  return null;
}

export async function readReceiptBlob(
  filePath: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const opened = await openReceiptBlobStream(filePath);
    if (!opened) return null;

    const bytes = await new Response(opened.stream).arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.length === 0) return null;

    return {
      buffer,
      mimeType: opened.mimeType,
    };
  } catch (err) {
    console.error("receipt blob buffer read failed", {
      filePath: filePath.slice(0, 80),
      err,
    });
    return null;
  }
}

export async function storeReceiptBlob(input: {
  reimbursementId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<string> {
  const pathname = `receipts/${input.reimbursementId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;
  const blob = await put(pathname, input.buffer, putOptions(input.mimeType));
  // Full URL is the most reliable reference for private blob reads.
  if (blob.url?.includes(".blob.vercel-storage.com/")) {
    return blob.url;
  }
  return `${BLOB_PREFIX}${blob.pathname}`;
}

export async function deleteReceiptBlob(filePath: string) {
  const target = blobGetTarget(filePath);
  if (!target || !receiptBlobStorageEnabled()) return;
  try {
    await del(target, blobConnectionOptions());
  } catch (err) {
    console.error("receipt blob delete failed", { target, err });
  }
}

async function blobPathOpens(filePath: string): Promise<boolean> {
  const opened = await openReceiptBlobStream(filePath);
  return opened !== null;
}

/** List blobs saved for a claim folder in storage. */
export async function listReceiptBlobsForClaim(reimbursementId: string) {
  if (!receiptBlobStorageEnabled()) return [];
  try {
    const result = await list({
      prefix: `receipts/${reimbursementId}/`,
      limit: 20,
      ...listOptions(),
    });
    return [...result.blobs].sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
    );
  } catch (err) {
    console.error("list receipt blobs failed", { reimbursementId, err });
    return [];
  }
}

/**
 * Files can exist in Blob while the DB still points at an old path (or has no row).
 * Find a readable blob for this claim and return its canonical URL.
 */
export async function resolveReceiptBlobPath(
  filePath: string,
  reimbursementId: string,
): Promise<string | null> {
  if (filePath?.trim() && (await blobPathOpens(filePath))) {
    return filePath;
  }

  const blobs = await listReceiptBlobsForClaim(reimbursementId);
  for (const blob of blobs) {
    const candidates = [
      blob.url,
      `${BLOB_PREFIX}${blob.pathname}`,
      blob.pathname,
    ];
    for (const candidate of candidates) {
      if (await blobPathOpens(candidate)) {
        return blob.url;
      }
    }
  }

  return null;
}

function mimeFromPathname(pathname: string) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

function fileNameFromPathname(pathname: string) {
  const segment = pathname.split("/").pop() ?? "receipt";
  const dash = segment.indexOf("-");
  return dash >= 0 ? segment.slice(dash + 1) : segment;
}

/** Create DB receipt rows when files exist in Blob but the claim has none linked. */
export async function syncClaimReceiptsFromBlob(reimbursementId: string) {
  if (!receiptBlobStorageEnabled()) return 0;

  const existing = await prisma.reimbursementReceipt.count({
    where: { reimbursementId },
  });
  if (existing > 0) return 0;

  const blobs = await listReceiptBlobsForClaim(reimbursementId);
  if (blobs.length === 0) return 0;

  await prisma.reimbursementReceipt.createMany({
    data: await Promise.all(
      blobs.map(async (blob) => {
        let mimeType = mimeFromPathname(blob.pathname);
        try {
          const meta = await head(blob.url, listOptions());
          if (meta.contentType) mimeType = meta.contentType;
        } catch {
          // keep guessed mime
        }
        return {
          reimbursementId,
          filePath: blob.url,
          fileName: fileNameFromPathname(blob.pathname),
          mimeType,
          sizeBytes: blob.size,
        };
      }),
    ),
  });

  console.info("linked orphan blob receipts to claim", {
    reimbursementId,
    count: blobs.length,
  });
  return blobs.length;
}

export async function probeReceiptBlobStorage(): Promise<{
  ok: boolean;
  error?: string;
  pathname?: string;
}> {
  if (!receiptBlobStorageEnabled()) {
    return { ok: false, error: "Blob is not configured on this deployment." };
  }

  const pathname = `_healthcheck/receipt-storage-${randomUUID()}.txt`;
  try {
    const blob = await put(pathname, Buffer.from("ok"), {
      access: "private",
      contentType: "text/plain",
      ...blobConnectionOptions(),
    });
    const readBack = await readReceiptBlob(`${BLOB_PREFIX}${blob.pathname}`);
    await del(blob.pathname);
    if (!readBack) {
      return { ok: false, error: "Blob upload succeeded but read-back failed." };
    }
    return { ok: true, pathname };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Blob upload test failed.",
    };
  }
}

export function receiptBlobEnvStatus() {
  return {
    runningOnVercel: Boolean(process.env.VERCEL),
    blobReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
    blobStoreId: Boolean(process.env.BLOB_STORE_ID?.trim()),
    vercelOidcToken: Boolean(process.env.VERCEL_OIDC_TOKEN?.trim()),
    enabled: receiptBlobStorageEnabled(),
    deploymentUrl: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : null,
  };
}

/** How many receipt files exist under receipts/ in Blob (not the same as DB rows). */
export async function countReceiptFilesInBlob() {
  if (!receiptBlobStorageEnabled()) return null;
  try {
    let total = 0;
    let cursor: string | undefined;
    do {
      const page = await list({
        prefix: "receipts/",
        limit: 1000,
        cursor,
        ...listOptions(),
      });
      total += page.blobs.length;
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return total;
  } catch (err) {
    console.error("count receipt files in blob failed", err);
    return null;
  }
}
