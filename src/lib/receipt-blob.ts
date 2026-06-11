import { del, get, getDownloadUrl, head, list, put } from "@vercel/blob";
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

/** Bearer token for direct blob URL fetches (read-write token preferred). */
function blobFetchAuthHeaders(): Record<string, string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function putOptions(contentType: string, access: "public" | "private" = "public") {
  return {
    access,
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

export function isReceiptBlobPath(filePath: string | null | undefined) {
  if (!filePath?.trim()) return false;
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

  if (filePath.startsWith(BLOB_PREFIX)) {
    const pathname = filePath.slice(BLOB_PREFIX.length);
    add(pathname);
    return targets;
  }

  const pathname = pathnameFromBlobReference(filePath);
  if (pathname) {
    // Pathname + store credentials is the most reliable read on Vercel.
    add(pathname);
  }

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    add(filePath);
  }

  if (filePath.includes(".blob.vercel-storage.com/") && !pathname) {
    add(filePath);
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

async function readReceiptBlobViaGet(
  target: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const result = await get(target, getOptions());
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const bytes = await new Response(result.stream).arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.length === 0) return null;
    return {
      buffer,
      mimeType: result.blob.contentType || "application/octet-stream",
    };
  } catch (err) {
    console.error("receipt blob get read failed", {
      target: target.slice(0, 120),
      err,
    });
    return null;
  }
}

/**
 * Read via the Blob metadata API + download URL.
 * Uploads use the Vercel API (OIDC); direct get() can fail without BLOB_READ_WRITE_TOKEN.
 */
async function readReceiptBlobViaHead(
  target: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const meta = await head(target, getOptions());
    const headers = blobFetchAuthHeaders();
    const urls = [meta.downloadUrl, getDownloadUrl(meta.url), meta.url];

    for (const url of urls) {
      const fetchUrl = new URL(url);
      fetchUrl.searchParams.set("cache", "0");
      for (const withAuth of [false, true]) {
        if (withAuth && !Object.keys(headers).length) continue;
        try {
          const res = await fetch(fetchUrl.toString(), {
            ...(withAuth ? { headers } : {}),
            cache: "no-store",
          });
          if (!res.ok) {
            console.error("receipt blob download failed", {
              target: target.slice(0, 80),
              status: res.status,
              authed: withAuth,
            });
            continue;
          }
          const buffer = Buffer.from(await res.arrayBuffer());
          if (buffer.length === 0) continue;
          return {
            buffer,
            mimeType: meta.contentType || "application/octet-stream",
          };
        } catch (fetchErr) {
          console.error("receipt blob download fetch error", {
            target: target.slice(0, 80),
            fetchErr,
          });
        }
      }
    }
    return null;
  } catch (err) {
    console.error("receipt blob head read failed", {
      target: target.slice(0, 120),
      err,
    });
    return null;
  }
}

/** Stream a private blob (used when buffering is not required). */
export async function openReceiptBlobStream(
  filePath: string,
): Promise<OpenedReceiptBlob | null> {
  const buffered = await readReceiptBlob(filePath);
  if (!buffered) return null;
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(buffered.buffer));
        controller.close();
      },
    }),
    mimeType: buffered.mimeType,
    sizeBytes: buffered.buffer.length,
  };
}

export async function readReceiptBlob(
  filePath: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const targets = blobGetTargets(filePath);
  // Without BLOB_READ_WRITE_TOKEN, direct get() often fails — prefer the metadata API.
  const preferHead = !process.env.BLOB_READ_WRITE_TOKEN?.trim();

  for (const target of targets) {
    if (preferHead) {
      const viaHead = await readReceiptBlobViaHead(target);
      if (viaHead) return viaHead;
      const viaGet = await readReceiptBlobViaGet(target);
      if (viaGet) return viaGet;
    } else {
      const viaGet = await readReceiptBlobViaGet(target);
      if (viaGet) return viaGet;
      const viaHead = await readReceiptBlobViaHead(target);
      if (viaHead) return viaHead;
    }
  }
  return null;
}

export async function storeReceiptBlob(input: {
  reimbursementId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<string> {
  const pathname = `receipts/${input.reimbursementId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;
  const blob = await put(pathname, input.buffer, putOptions(input.mimeType, "public"));
  if (blob.url?.includes(".blob.vercel-storage.com/")) {
    return blob.url;
  }
  return `${BLOB_PREFIX}${blob.pathname}`;
}

/** Re-save a private blob as public so the browser can load it directly. */
export async function promoteReceiptToPublicBlob(input: {
  reimbursementId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  oldPath: string;
}): Promise<string | null> {
  if (!receiptBlobStorageEnabled()) return null;
  try {
    const publicUrl = await storeReceiptBlob({
      reimbursementId: input.reimbursementId,
      fileName: input.fileName,
      buffer: input.buffer,
      mimeType: input.mimeType,
    });
    void deleteReceiptBlob(input.oldPath);
    return publicUrl;
  } catch (err) {
    console.error("promote receipt to public blob failed", { err });
    return null;
  }
}

export function isPublicReceiptBlobPath(filePath: string) {
  return filePath.startsWith("https://") && filePath.includes(".blob.vercel-storage.com/");
}

/** One-time upgrade: private blob paths → public URLs the browser can load directly. */
export async function upgradeReceiptsToPublicUrls(
  reimbursementId: string,
  receipts: { id: string; filePath: string; fileName: string | null; mimeType: string }[],
) {
  if (!receiptBlobStorageEnabled()) return;

  for (const receipt of receipts) {
    if (
      !isReceiptBlobPath(receipt.filePath) ||
      isPublicReceiptBlobPath(receipt.filePath)
    ) {
      continue;
    }

    const blob = await readReceiptBlob(receipt.filePath);
    if (!blob) continue;

    const publicUrl = await promoteReceiptToPublicBlob({
      reimbursementId,
      fileName: receipt.fileName ?? "receipt",
      buffer: blob.buffer,
      mimeType: blob.mimeType || receipt.mimeType,
      oldPath: receipt.filePath,
    });
    if (!publicUrl) continue;

    await prisma.reimbursementReceipt.update({
      where: { id: receipt.id },
      data: { filePath: publicUrl },
    });
    receipt.filePath = publicUrl;
  }
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
  for (const target of blobGetTargets(filePath)) {
    try {
      await head(target, getOptions());
      return true;
    } catch {
      // try next target
    }
  }
  return false;
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
        if (candidate.startsWith(BLOB_PREFIX)) return candidate;
        if (candidate.includes(".blob.vercel-storage.com/")) return candidate;
        return `${BLOB_PREFIX}${blob.pathname}`;
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
          const meta = await head(blob.url, getOptions());
          if (meta.contentType) mimeType = meta.contentType;
        } catch {
          // keep guessed mime
        }
        return {
          reimbursementId,
          filePath: blob.url?.includes(".blob.vercel-storage.com/")
            ? blob.url
            : `${BLOB_PREFIX}${blob.pathname}`,
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
    const blob = await put(pathname, Buffer.from("ok"), putOptions("text/plain", "public"));
    const readBack = await readReceiptBlob(blob.url ?? `${BLOB_PREFIX}${blob.pathname}`);
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
