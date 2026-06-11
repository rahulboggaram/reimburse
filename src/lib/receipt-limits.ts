export const MAX_RECEIPTS = 10;

/** Target max size per receipt file after compression (upload limit). */
export const MAX_RECEIPT_FILE_BYTES = 4 * 1024 * 1024;

export function isReceiptFileTooLarge(sizeBytes: number) {
  return sizeBytes > MAX_RECEIPT_FILE_BYTES;
}

export function receiptStillTooLargeError() {
  return "This photo is still too large after compression. Try a different image.";
}

export function receiptPdfSizeError() {
  return "PDF receipts must be 4 MB or smaller.";
}
