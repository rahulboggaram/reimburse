import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { MAX_RECEIPTS } from "@/lib/receipt-limits";

const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};

export type SavedReceipt = {
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

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
  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      return "Use photos (JPG, PNG, WEBP) or PDF receipts.";
    }
    if (file.size > MAX_BYTES) {
      return "Each file must be 5 MB or smaller.";
    }
  }
  return null;
}

export async function saveReceiptFiles(
  reimbursementId: string,
  files: File[],
): Promise<SavedReceipt[]> {
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "receipts",
    reimbursementId,
  );
  await mkdir(dir, { recursive: true });

  const saved: SavedReceipt[] = [];
  for (const file of files) {
    const ext = EXT_BY_MIME[file.type] ?? (path.extname(file.name) || ".bin");
    const storedName = `${randomUUID()}${ext}`;
    const absolutePath = path.join(dir, storedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);
    saved.push({
      filePath: `/uploads/receipts/${reimbursementId}/${storedName}`,
      fileName: file.name || storedName,
      mimeType: file.type,
      sizeBytes: file.size,
    });
  }
  return saved;
}

export async function deleteReceiptFilesForClaim(reimbursementId: string) {
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "receipts",
    reimbursementId,
  );
  await rm(dir, { recursive: true, force: true });
}
