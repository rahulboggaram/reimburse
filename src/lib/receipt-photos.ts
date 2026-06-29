import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

import { inferReceiptMimeType } from "@/lib/receipt-mime";
import type { ReceiptInput } from "@/lib/receipt-input";
import { parseStoredReceiptDataUrl } from "@/lib/receipt-content-parse";
import { isDatabaseReceiptPath, isSupabaseReceiptPath } from "@/lib/receipt-store";
import {
  buildReceiptObjectPath,
  deleteReceiptObjects,
  downloadReceiptObject,
  isSupabaseStorageEnabled,
  uploadReceiptObject,
} from "@/lib/supabase-storage";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export type SavedReceiptPhoto = {
  /** Storage key: Supabase object path, local /uploads path, or legacy data: URL */
  filePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type ReceiptPhotoRow = {
  filePath: string;
  fileName: string | null;
  mimeType: string;
  sizeBytes: number | null;
};

function extensionFor(mimeType: string, fileName: string) {
  return EXT_BY_MIME[mimeType] ?? path.extname(fileName) ?? ".jpg";
}

function prepareBytes(input: ReceiptInput) {
  const mimeType =
    inferReceiptMimeType({ type: input.type, name: input.name }) ||
    "application/octet-stream";
  const buffer = input.buffer;
  if (!buffer.length) {
    throw new Error(`Receipt "${input.name || "photo"}" is empty.`);
  }
  return {
    buffer,
    mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType,
    fileName: input.name || `receipt-${randomUUID()}`,
  };
}

function storageNotConfiguredError() {
  return new Error(
    "Receipt storage is not set up. Add SUPABASE_URL and SUPABASE_SECRET_KEY on Vercel, then create the receipts bucket.",
  );
}

/** Save photos when submitting a claim. */
export async function saveReceiptPhotos(
  claimId: string,
  inputs: ReceiptInput[],
): Promise<SavedReceiptPhoto[]> {
  if (process.env.VERCEL) {
    if (!isSupabaseStorageEnabled()) {
      throw storageNotConfiguredError();
    }

    return Promise.all(
      inputs.map(async (input) => {
        const prepared = prepareBytes(input);
        const storedName = `${randomUUID()}${extensionFor(prepared.mimeType, prepared.fileName)}`;
        const storagePath = buildReceiptObjectPath(claimId, storedName);
        await uploadReceiptObject(
          storagePath,
          prepared.buffer,
          prepared.mimeType,
        );
        return {
          filePath: storagePath,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          sizeBytes: prepared.buffer.length,
        };
      }),
    );
  }

  const dir = path.join(process.cwd(), "public", "uploads", "receipts", claimId);
  await mkdir(dir, { recursive: true });

  return Promise.all(
    inputs.map(async (input) => {
      const prepared = prepareBytes(input);
      const storedName = `${randomUUID()}${extensionFor(prepared.mimeType, prepared.fileName)}`;
      await writeFile(path.join(dir, storedName), prepared.buffer);
      return {
        filePath: `/uploads/receipts/${claimId}/${storedName}`,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        sizeBytes: prepared.buffer.length,
      };
    }),
  );
}

/** Load photo bytes for /api/receipts/:id */
export async function loadReceiptPhotoBytes(
  row: ReceiptPhotoRow,
): Promise<Buffer> {
  const filePath = row.filePath?.trim() ?? "";
  if (!filePath) {
    throw new Error("This receipt has no photo on record. Refile with a new image.");
  }

  if (isSupabaseReceiptPath(filePath)) {
    return downloadReceiptObject(filePath);
  }

  if (isDatabaseReceiptPath(filePath)) {
    const parsed =
      parseStoredReceiptDataUrl(filePath, row.sizeBytes) ??
      parseStoredReceiptDataUrl(filePath);
    if (!parsed?.buffer.length) {
      throw new Error(
        "This receipt photo is damaged. Refile the claim with a new image.",
      );
    }
    return parsed.buffer;
  }

  if (filePath.startsWith("/uploads/")) {
    if (process.env.VERCEL) {
      throw new Error("This receipt was saved locally. Refile with a new photo.");
    }
    return readFile(path.join(process.cwd(), "public", filePath));
  }

  throw new Error("This receipt photo is unavailable. Refile with a new image.");
}

export function serveReceiptImage(
  buffer: Buffer,
  mimeType: string,
  fileName: string | null,
) {
  const name = (fileName ?? "receipt").replace(/"/g, "'");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function deleteReceiptPhotoFiles(filePaths: string[]) {
  const storagePaths = filePaths.filter(isSupabaseReceiptPath);
  if (storagePaths.length > 0 && isSupabaseStorageEnabled()) {
    await deleteReceiptObjects(storagePaths);
  }
}

export async function deleteLocalReceiptFolder(claimId: string) {
  if (process.env.VERCEL) return;
  const dir = path.join(process.cwd(), "public", "uploads", "receipts", claimId);
  await rm(dir, { recursive: true, force: true });
}
