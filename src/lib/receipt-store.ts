/** Helpers for receipt file paths stored in ReimbursementReceipt.filePath */

export function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export function isDatabaseReceiptPath(filePath: string) {
  return filePath.startsWith("data:");
}

/** Path inside the Supabase receipts bucket, e.g. claimId/uuid.jpg */
export function isSupabaseReceiptPath(filePath: string) {
  const trimmed = filePath.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("/uploads/")) {
    return false;
  }
  return trimmed.includes("/");
}
