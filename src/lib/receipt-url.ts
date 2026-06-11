/** Authenticated API fallback for legacy storage paths only. */
export function receiptViewUrl(receiptId: string): string {
  return `/api/receipts/${receiptId}`;
}

/** URL the browser uses in <img src> — data URLs load directly with no extra API call. */
export function receiptClientUrl(receipt: {
  id: string;
  filePath: string;
}): string {
  const path = receipt.filePath?.trim() ?? "";
  if (path.startsWith("data:")) {
    return path;
  }
  if (path.startsWith("/uploads/")) {
    return path;
  }
  return receiptViewUrl(receipt.id);
}

export function isDirectReceiptUrl(url: string) {
  return (
    url.startsWith("data:") ||
    url.startsWith("/uploads/") ||
    (url.startsWith("https://") && url.includes(".blob.vercel-storage.com/"))
  );
}
