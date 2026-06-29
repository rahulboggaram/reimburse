import {
  isReceiptFileTooLarge,
  MAX_RECEIPTS,
  receiptPdfSizeError,
  receiptStillTooLargeError,
} from "@/lib/receipt-limits";
import type { ReceiptInput } from "@/lib/receipt-input";
import { inferReceiptMimeType } from "@/lib/receipt-mime";
import {
  deleteLocalReceiptFolder,
  deleteReceiptPhotoFiles,
  saveReceiptPhotos,
  type SavedReceiptPhoto,
} from "@/lib/receipt-photos";

/** Vercel serverless request body limit is ~4.5 MB — stay under that total. */
const MAX_TOTAL_UPLOAD_BYTES = 3_500_000;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export type SavedReceipt = SavedReceiptPhoto;

export function receiptFilesFromFormData(formData: FormData): File[] {
  return formData
    .getAll("receipts")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export function validateReceiptFiles(files: File[]): string | null {
  if (files.length === 0) {
    return "Add at least one receipt photo.";
  }
  if (files.length > MAX_RECEIPTS) {
    return `You can attach up to ${MAX_RECEIPTS} photos.`;
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
    return "Total photo size is too large. Use fewer or smaller photos.";
  }
  for (const file of files) {
    const mimeType = inferReceiptMimeType(file);
    if (!ALLOWED_MIME.has(mimeType)) {
      return "Use photos (JPG, PNG, WEBP) or PDF receipts.";
    }
    if (isReceiptFileTooLarge(file.size)) {
      return mimeType === "application/pdf"
        ? receiptPdfSizeError()
        : receiptStillTooLargeError();
    }
  }
  return null;
}

export function validateReceiptInputs(inputs: ReceiptInput[]): string | null {
  if (inputs.length === 0) {
    return "Add at least one receipt photo.";
  }
  if (inputs.length > MAX_RECEIPTS) {
    return `You can attach up to ${MAX_RECEIPTS} photos.`;
  }
  const totalBytes = inputs.reduce((sum, input) => sum + input.size, 0);
  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
    return "Total photo size is too large. Use fewer or smaller photos.";
  }
  for (const input of inputs) {
    const mimeType = inferReceiptMimeType({ type: input.type, name: input.name });
    if (!ALLOWED_MIME.has(mimeType)) {
      return "Use photos (JPG, PNG, WEBP) or PDF receipts.";
    }
    if (isReceiptFileTooLarge(input.size)) {
      return mimeType === "application/pdf"
        ? receiptPdfSizeError()
        : receiptStillTooLargeError();
    }
  }
  return null;
}

export async function saveReceiptFiles(
  reimbursementId: string,
  files: File[],
): Promise<SavedReceipt[]> {
  if (files.length === 0) return [];
  const inputs = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );
  return saveReceiptInputs(reimbursementId, inputs);
}

export async function saveReceiptInputs(
  reimbursementId: string,
  inputs: ReceiptInput[],
): Promise<SavedReceipt[]> {
  return saveReceiptPhotos(reimbursementId, inputs);
}

export async function deleteStoredReceiptFiles(filePaths: string[]) {
  await deleteReceiptPhotoFiles(filePaths);
}

export async function deleteReceiptFilesForClaim(reimbursementId: string) {
  await deleteLocalReceiptFolder(reimbursementId);
}
