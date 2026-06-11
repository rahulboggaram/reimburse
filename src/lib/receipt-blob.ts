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

/** Value passed to @vercel/blob get() — full URL or pathname. */
export function blobGetTarget(filePath: string): string | null {
  if (!filePath?.trim()) return null;

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  if (filePath.startsWith(BLOB_PREFIX)) {
    return filePath.slice(BLOB_PREFIX.length);
  }

  if (filePath.includes(".blob.vercel-storage.com/")) {
    return filePath;
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
  const blob = await put(pathname, input.buffer, putOptions(input.mimeType));
  // Store the full private URL — most reliable for later reads via get().
  return blob.url;
}

export async function readReceiptBlob(
  filePath: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const target = blobGetTarget(filePath);
  if (!target) return null;

  try {
    const result = await get(target, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) {
      console.error("receipt blob get empty", {
        filePath: filePath.slice(0, 80),
        target: target.slice(0, 120),
        statusCode: result?.statusCode ?? "null",
      });
      return null;
    }

    const bytes = await new Response(result.stream).arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.length === 0) return null;

    return {
      buffer,
      mimeType: result.blob.contentType || "application/octet-stream",
    };
  } catch (err) {
    console.error("receipt blob get failed", {
      filePath: filePath.slice(0, 80),
      target: target.slice(0, 120),
      err,
    });
    return null;
  }
}

export async function deleteReceiptBlob(filePath: string) {
  const target = blobGetTarget(filePath);
  if (!target || !receiptBlobStorageEnabled()) return;
  try {
    await del(target);
  } catch (err) {
    console.error("receipt blob delete failed", { target, err });
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
    const blob = await put(pathname, Buffer.from("ok"), {
      access: "private",
      contentType: "text/plain",
    });
    const readBack = await readReceiptBlob(blob.url);
    await del(blob.url);
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
  };
}
