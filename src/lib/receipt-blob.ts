import { del, get, put } from "@vercel/blob";
import { randomUUID } from "crypto";

const BLOB_PREFIX = "blob:";

export function receiptBlobStorageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function blobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  return token;
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
  const blob = await put(pathname, input.buffer, {
    access: "private",
    contentType: input.mimeType,
    token: blobToken(),
  });
  return `${BLOB_PREFIX}${blob.pathname}`;
}

export async function readReceiptBlob(
  filePath: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const pathname = blobPathname(filePath);
  if (!pathname) return null;

  const result = await get(pathname, {
    access: "private",
    token: blobToken(),
  });
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
    await del(pathname, { token: blobToken() });
  } catch (err) {
    console.error("receipt blob delete failed", { pathname, err });
  }
}
