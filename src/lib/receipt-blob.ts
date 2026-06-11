import { del, get, getDownloadUrl, head, list } from "@vercel/blob";

const BLOB_PREFIX = "blob:";

export function receiptBlobStorageEnabled() {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  if (process.env.VERCEL && process.env.BLOB_STORE_ID?.trim()) return true;
  return false;
}

function blobConnectionOptions() {
  const options: { token?: string; storeId?: string } = {};
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (token) options.token = token;
  if (storeId) options.storeId = storeId;
  return options;
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

export function isReceiptBlobPath(filePath: string | null | undefined) {
  if (!filePath?.trim()) return false;
  return (
    filePath.startsWith(BLOB_PREFIX) ||
    filePath.includes(".blob.vercel-storage.com/")
  );
}

function blobGetTargets(filePath: string): string[] {
  if (!filePath?.trim()) return [];

  const targets: string[] = [];
  const add = (value: string | null | undefined) => {
    if (!value) return;
    if (!targets.includes(value)) targets.push(value);
  };

  if (filePath.startsWith(BLOB_PREFIX)) {
    add(filePath.slice(BLOB_PREFIX.length));
    return targets;
  }

  try {
    const url = new URL(filePath);
    if (url.hostname.endsWith(".blob.vercel-storage.com")) {
      add(url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname);
      add(filePath);
    }
  } catch {
    // not a URL
  }

  return targets;
}

function blobGetTarget(filePath: string): string | null {
  return blobGetTargets(filePath)[0] ?? null;
}

async function readViaHead(target: string) {
  try {
    const meta = await head(target, getOptions());
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    const authHeaders: Record<string, string> = token
      ? { authorization: `Bearer ${token}` }
      : {};

    for (const url of [meta.downloadUrl, getDownloadUrl(meta.url), meta.url]) {
      const fetchUrl = new URL(url);
      fetchUrl.searchParams.set("cache", "0");
      for (const withAuth of [false, true]) {
        if (withAuth && !token) continue;
        const res = await fetch(fetchUrl.toString(), {
          headers: withAuth && token ? authHeaders : undefined,
          cache: "no-store",
        });
        if (!res.ok) continue;
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length === 0) continue;
        return {
          buffer,
          mimeType: meta.contentType || "application/octet-stream",
        };
      }
    }
  } catch {
    // try next target
  }
  return null;
}

async function readViaGet(target: string) {
  try {
    const result = await get(target, getOptions());
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
    if (buffer.length === 0) return null;
    return {
      buffer,
      mimeType: result.blob.contentType || "application/octet-stream",
    };
  } catch {
    return null;
  }
}

/** Legacy only — read a receipt still stored in Vercel Blob before migration. */
export async function readReceiptBlob(
  filePath: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const preferHead = !process.env.BLOB_READ_WRITE_TOKEN?.trim();
  for (const target of blobGetTargets(filePath)) {
    if (preferHead) {
      const viaHead = await readViaHead(target);
      if (viaHead) return viaHead;
      const viaGet = await readViaGet(target);
      if (viaGet) return viaGet;
    } else {
      const viaGet = await readViaGet(target);
      if (viaGet) return viaGet;
      const viaHead = await readViaHead(target);
      if (viaHead) return viaHead;
    }
  }
  return null;
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

/** Delete every file in the Vercel Blob store (one-time cleanup). */
export async function purgeAllReceiptBlobsFromStore(): Promise<{
  deleted: number;
  error?: string;
}> {
  if (!receiptBlobStorageEnabled()) {
    return { deleted: 0, error: "Blob is not configured on this deployment." };
  }

  let deleted = 0;
  let cursor: string | undefined;

  try {
    do {
      const page = await list({
        limit: 1000,
        cursor,
        ...listOptions(),
      });

      if (page.blobs.length > 0) {
        const urls = page.blobs.map((blob) => blob.url);
        await del(urls, blobConnectionOptions());
        deleted += urls.length;
      }

      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    return { deleted };
  } catch (err) {
    return {
      deleted,
      error: err instanceof Error ? err.message : "Blob purge failed.",
    };
  }
}

export async function countReceiptFilesInBlob(): Promise<number | null> {
  if (!receiptBlobStorageEnabled()) return null;
  try {
    let total = 0;
    let cursor: string | undefined;
    do {
      const page = await list({
        limit: 1000,
        cursor,
        ...listOptions(),
      });
      total += page.blobs.length;
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return total;
  } catch {
    return null;
  }
}
