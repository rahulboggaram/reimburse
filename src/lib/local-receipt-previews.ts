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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Keep a copy of picked photos as data URLs (blob: URLs die when the form unmounts). */
export async function stashLocalReceiptPreviews(
  claimId: string,
  items: { previewUrl: string; file: File }[],
) {
  if (typeof window === "undefined" || items.length === 0) return;
  try {
    const rows: StoredRow[] = await Promise.all(
      items.map(async (item) => {
        let url = item.previewUrl;
        if (item.file.type.startsWith("image/")) {
          try {
            url = await fileToDataUrl(item.file);
          } catch {
            // keep previewUrl if conversion fails
          }
        }
        return {
          url,
          mimeType: item.file.type || "image/jpeg",
          fileName: item.file.name || null,
          savedAt: Date.now(),
        };
      }),
    );
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
