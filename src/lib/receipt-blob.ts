import { del, get, put } from "@vercel/blob";
import { randomUUID } from "crypto";

const BLOB_PREFIX = "blob:";

/** True when Vercel Blob is linked to this project (token or OIDC store id). */
export function receiptBlobStorageEnabled() {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  if (process.env.VERCEL && process.env.BLOB_STORE_ID?.trim()) return true;
  return false;
}

function putOptions(contentType: string) {
  return {
    access: "private" as const,
    contentType,
    // Let the SDK use BLOB_READ_WRITE_TOKEN or Vercel OIDC automatically.
  };
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

function blobPathname(filePath: string): string | null {
  if (filePath.startsWith(BLOB_PREFIX)) {
    return filePath.slice(BLOB_PREFIX.length);
  }
  try {
    const url = new URL(filePath);
    if (!url.hostname.endsWith(".blob.vercel-storage.com")) return null;
    return url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
  } catch {
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
  return `${BLOB_PREFIX}${blob.pathname}`;
}

export async function readReceiptBlob(
  filePath: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const pathname = blobPathname(filePath);
  if (!pathname) return null;

  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) return null;

  const bytes = await new Response(result.stream).arrayBuffer();
  const buffer = Buffer.from(bytes);
  if (buffer.length === 0) return null;

  return {
    buffer,
    mimeType: result.blob.contentType || "application/octet-stream",
  };
}

export async function deleteReceiptBlob(filePath: string) {
  const pathname = blobPathname(filePath);
  if (!pathname || !receiptBlobStorageEnabled()) return;
  try {
    await del(pathname);
  } catch (err) {
    console.error("receipt blob delete failed", { pathname, err });
  }
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
    await put(pathname, Buffer.from("ok"), {
      access: "private",
      contentType: "text/plain",
    });
    await del(pathname);
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
  };
}
