import { compressReceiptFile } from "@/lib/compress-receipt-image";
import {
  migrateIndexedReceiptPreviews,
  readIndexedReceiptPreviews,
  writeIndexedReceiptPreviews,
} from "@/lib/local-receipt-indexed-db";

export type LocalReceiptPreview = {
  url: string;
  mimeType: string;
  fileName: string | null;
};

const KEY_PREFIX = "reimburse-local-receipt-previews:";
const TTL_MS = 24 * 60 * 60 * 1000;

type StoredRow = LocalReceiptPreview & { savedAt: number };

function storageKey(claimId: string) {
  return `${KEY_PREFIX}${claimId}`;
}

const LOCAL_PREVIEW_PASSTHROUGH_BYTES = 350_000;

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fileToCompactPreviewDataUrl(file: File): Promise<string> {
  const prepared =
    file.type.startsWith("image/") && file.type !== "image/gif"
      ? await compressReceiptFile(file)
      : file;

  if (!prepared.type.startsWith("image/")) {
    return readFileAsDataUrl(prepared);
  }

  // Small photos (e.g. 185 KB) stay at full quality — only large screenshots get shrunk.
  if (prepared.size <= LOCAL_PREVIEW_PASSTHROUGH_BYTES) {
    return readFileAsDataUrl(prepared);
  }

  const bitmap = await createImageBitmap(prepared);
  const maxEdge = 960;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare receipt preview");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.78);
  });
  if (!blob) {
    throw new Error("Could not prepare receipt preview");
  }

  return readFileAsDataUrl(blob);
}

/** Keep copies of picked photos so previews work before and right after submit. */
export async function stashLocalReceiptPreviews(
  claimId: string,
  items: { previewUrl: string; file: File }[],
) {
  if (typeof window === "undefined" || items.length === 0) return;

  const rows: StoredRow[] = await Promise.all(
    items.map(async (item) => {
      let url = item.previewUrl;
      let mimeType = item.file.type || "image/jpeg";

      if (item.file.type.startsWith("image/")) {
        try {
          url = await fileToCompactPreviewDataUrl(item.file);
          mimeType = "image/jpeg";
        } catch {
          // keep blob previewUrl if conversion fails
        }
      }

      return {
        url,
        mimeType,
        fileName: item.file.name || null,
        savedAt: Date.now(),
      };
    }),
  );

  try {
    sessionStorage.setItem(storageKey(claimId), JSON.stringify(rows));
  } catch {
    // fall through to IndexedDB
  }

  void writeIndexedReceiptPreviews(claimId, rows);
}

export function readLocalReceiptPreviews(
  claimId: string,
): LocalReceiptPreview[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(claimId));
    if (!raw) return null;
    const rows = JSON.parse(raw) as StoredRow[];
    const now = Date.now();
    const fresh = rows.filter((row) => now - row.savedAt < TTL_MS);
    if (fresh.length === 0) {
      sessionStorage.removeItem(storageKey(claimId));
      return null;
    }
    return fresh.map(({ url, mimeType, fileName }) => ({
      url,
      mimeType,
      fileName,
    }));
  } catch {
    return null;
  }
}

/** Session storage first, then IndexedDB (larger screenshots). */
export async function readLocalReceiptPreviewsAsync(
  claimId: string,
): Promise<LocalReceiptPreview[] | null> {
  const session = readLocalReceiptPreviews(claimId);
  if (session?.length) return session;
  return readIndexedReceiptPreviews(claimId);
}

export function clearLocalReceiptPreviews(claimId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(claimId));
  } catch {
    // ignore
  }
}

export function migrateLocalReceiptPreviews(fromClaimId: string, toClaimId: string) {
  if (typeof window === "undefined" || fromClaimId === toClaimId) return;
  try {
    const raw = sessionStorage.getItem(storageKey(fromClaimId));
    if (raw) {
      sessionStorage.setItem(storageKey(toClaimId), raw);
      sessionStorage.removeItem(storageKey(fromClaimId));
    }
  } catch {
    // ignore
  }
  void migrateIndexedReceiptPreviews(fromClaimId, toClaimId);
}
