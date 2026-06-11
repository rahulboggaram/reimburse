import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { MAX_RECEIPTS } from "@/lib/receipt-limits";
import type { ReceiptInput } from "@/lib/receipt-input";
import { normalizeReceiptImageBuffer } from "@/lib/normalize-receipt-image";
import { inferReceiptMimeType } from "@/lib/receipt-mime";
import { bufferToDataUrl } from "@/lib/receipt-store";

const MAX_BYTES = 5 * 1024 * 1024;
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
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
    return "Total photo size is too large. Use fewer or smaller photos.";
  }
  for (const file of files) {
    const mimeType = inferReceiptMimeType(file);
    if (!ALLOWED_MIME.has(mimeType)) {
      return "Use photos (JPG, PNG, WEBP) or PDF receipts.";
    }
    if (file.size > MAX_BYTES) {
      return "Each file must be 5 MB or smaller.";
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
    if (input.size > MAX_BYTES) {
      return "Each file must be 5 MB or smaller.";
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

async function normalizeReceiptInput(input: ReceiptInput) {
  const declaredMime =
    inferReceiptMimeType({ type: input.type, name: input.name }) ||
    "application/octet-stream";
  const normalized = await normalizeReceiptImageBuffer(
    input.buffer,
    declaredMime,
  );
  const buffer =
    normalized.buffer.length > 0 ? normalized.buffer : input.buffer;
  const mimeType =
    normalized.buffer.length > 0 ? normalized.mimeType : declaredMime;
  if (buffer.length === 0) {
    throw new Error(`Receipt "${input.name || "file"}" is empty.`);
  }
  return {
    fileName: input.name || `receipt-${randomUUID()}`,
    buffer,
    mimeType,
  };
}

export async function saveReceiptInputs(
  reimbursementId: string,
  inputs: ReceiptInput[],
): Promise<SavedReceipt[]> {
  if (process.env.VERCEL) {
    return Promise.all(
      inputs.map(async (input) => {
        const normalized = await normalizeReceiptInput(input);
        if (normalized.buffer.length > MAX_TOTAL_UPLOAD_BYTES) {
          throw new Error(
            "Photo is too large after compression. Try a smaller image.",
          );
        }
        const filePath = bufferToDataUrl(normalized.buffer, normalized.mimeType);
        return {
          filePath,
          fileName: normalized.fileName,
          mimeType: normalized.mimeType,
          sizeBytes: normalized.buffer.length,
        };
      }),
    );
  }

  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "receipts",
    reimbursementId,
  );
  await mkdir(dir, { recursive: true });

  return Promise.all(
    inputs.map(async (input) => {
      const normalized = await normalizeReceiptInput(input);
      const ext =
        EXT_BY_MIME[normalized.mimeType] ?? (path.extname(input.name) || ".bin");
      const storedName = `${randomUUID()}${ext}`;
      const absolutePath = path.join(dir, storedName);
      await writeFile(absolutePath, normalized.buffer);
      return {
        filePath: `/uploads/receipts/${reimbursementId}/${storedName}`,
        fileName: normalized.fileName,
        mimeType: normalized.mimeType,
        sizeBytes: normalized.buffer.length,
      };
    }),
  );
}

export async function deleteStoredReceiptFiles(_filePaths: string[]) {
  // Receipt bytes live in the database on Vercel — nothing to delete externally.
}

export async function deleteReceiptFilesForClaim(reimbursementId: string) {
  if (process.env.VERCEL) return;
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "receipts",
    reimbursementId,
  );
  await rm(dir, { recursive: true, force: true });
}
