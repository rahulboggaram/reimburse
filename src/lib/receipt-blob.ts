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
      const result = await get(target, { access: "private", useCache: false });
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
  const opened = await openReceiptBlobStream(filePath);
  if (!opened) return null;

  const bytes = await new Response(opened.stream).arrayBuffer();
  const buffer = Buffer.from(bytes);
  if (buffer.length === 0) return null;

  return {
    buffer,
    mimeType: opened.mimeType,
  };
}

export async function storeReceiptBlob(input: {
  reimbursementId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<string> {
  const pathname = `receipts/${input.reimbursementId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;
  const blob = await put(pathname, input.buffer, putOptions(input.mimeType));
  // Store pathname — stable across stores; full URL also works when reading.
  return `${BLOB_PREFIX}${blob.pathname}`;
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
  };
}
