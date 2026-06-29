/** Serves receipt bytes from Supabase Storage (or local disk in dev) with session auth. */
export function receiptViewUrl(receiptId: string): string {
  return `/api/receipts/${receiptId}`;
}

/** Always use the API — keeps claim JSON small (no multi‑MB base64 strings). */
export function receiptClientUrl(receipt: { id: string }): string {
  return receiptViewUrl(receipt.id);
}

export function isDirectReceiptUrl(url: string) {
  return (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("/uploads/")
  );
}
