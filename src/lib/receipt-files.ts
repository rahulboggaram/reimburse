import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { MAX_RECEIPTS } from "@/lib/receipt-limits";
import type { ReceiptInput } from "@/lib/receipt-input";

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

export function validateReceiptInputs(inputs: ReceiptInput[]): string | null {
  if (inputs.length === 0) {
    return "Add at least one receipt photo.";
  }
  if (inputs.length > MAX_RECEIPTS) {
    return `You can attach up to ${MAX_RECEIPTS} photos.`;
  }
  for (const input of inputs) {
    if (!ALLOWED_MIME.has(input.type)) {
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

export async function saveReceiptInputs(
  reimbursementId: string,
  inputs: ReceiptInput[],
): Promise<SavedReceipt[]> {
  if (process.env.VERCEL) {
    return inputs.map((input) => {
      const base64 = input.buffer.toString("base64");
      const mimeType = input.type || "application/octet-stream";
      return {
        filePath: `data:${mimeType};base64,${base64}`,
        fileName: input.name || `receipt-${randomUUID()}`,
        mimeType,
        sizeBytes: input.size,
      };
    });
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
      const ext = EXT_BY_MIME[input.type] ?? (path.extname(input.name) || ".bin");
      const storedName = `${randomUUID()}${ext}`;
      const absolutePath = path.join(dir, storedName);
      await writeFile(absolutePath, input.buffer);
      return {
        filePath: `/uploads/receipts/${reimbursementId}/${storedName}`,
        fileName: input.name || storedName,
        mimeType: input.type,
        sizeBytes: input.size,
      };
    }),
  );
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
