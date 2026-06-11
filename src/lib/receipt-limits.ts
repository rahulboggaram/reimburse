export const MAX_RECEIPTS = 10;

/** Max size per photo/PDF the user can attach (before submit). */
export const MAX_RECEIPT_FILE_BYTES = 4 * 1024 * 1024;

export function isReceiptFileTooLarge(sizeBytes: number) {
  return sizeBytes > MAX_RECEIPT_FILE_BYTES;
}

export function receiptFileSizeError() {
  return "Each photo must be 4 MB or smaller.";
}
