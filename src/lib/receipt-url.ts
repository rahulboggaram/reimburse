/** Max data-URL length inlined in claim JSON (avoids huge payloads). */
const MAX_INLINE_DATA_URL = 600_000;

/** Authenticated API fallback when the browser cannot load the file directly. */
export function receiptViewUrl(receiptId: string): string {
  return `/api/receipts/${receiptId}`;
}

export function isPublicBlobUrl(filePath: string) {
  return (
    filePath.startsWith("https://") &&
    filePath.includes(".blob.vercel-storage.com/")
  );
}

/** True when the browser can show the receipt without calling /api/receipts. */
export function isDirectReceiptUrl(url: string) {
  return (
    url.startsWith("blob:") ||
    url.startsWith("data:") ||
    isPublicBlobUrl(url)
  );
}

/**
 * Best URL for <img src> / gallery previews.
 * Public Blob URLs and small data-URLs load directly; everything else uses the API.
 */
export function receiptClientUrl(receipt: {
  id: string;
  filePath: string;
}): string {
  const path = receipt.filePath?.trim() ?? "";
  if (path.startsWith("data:") && path.length <= MAX_INLINE_DATA_URL) {
    return path;
  }
  if (isPublicBlobUrl(path)) {
    return path;
  }
  return receiptViewUrl(receipt.id);
}
