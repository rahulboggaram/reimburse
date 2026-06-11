export type LocalReceiptPreview = {
  url: string;
  mimeType: string;
  fileName: string | null;
};

const KEY_PREFIX = "reimburse-local-receipt-previews:";
const TTL_MS = 30 * 60 * 1000;

type StoredRow = LocalReceiptPreview & { savedAt: number };

function storageKey(claimId: string) {
  return `${KEY_PREFIX}${claimId}`;
}

export function stashLocalReceiptPreviews(
  claimId: string,
  items: { previewUrl: string; file: File }[],
) {
  if (typeof window === "undefined" || items.length === 0) return;
  try {
    const rows: StoredRow[] = items.map((item) => ({
      url: item.previewUrl,
      mimeType: item.file.type || "image/jpeg",
      fileName: item.file.name || null,
      savedAt: Date.now(),
    }));
    sessionStorage.setItem(storageKey(claimId), JSON.stringify(rows));
  } catch {
    // ignore quota errors
  }
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

export function clearLocalReceiptPreviews(claimId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(claimId));
  } catch {
    // ignore
  }
}
