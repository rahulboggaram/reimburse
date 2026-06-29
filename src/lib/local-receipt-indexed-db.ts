import type { LocalReceiptPreview } from "@/lib/local-receipt-previews";

const DB_NAME = "reimburse-receipt-previews";
const STORE = "previews";
const DB_VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoredRow = LocalReceiptPreview & { savedAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function writeIndexedReceiptPreviews(
  claimId: string,
  rows: StoredRow[],
) {
  if (typeof window === "undefined" || rows.length === 0) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rows, claimId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore — sessionStorage may still have thumbnails
  }
}

export async function readIndexedReceiptPreviews(
  claimId: string,
): Promise<LocalReceiptPreview[] | null> {
  if (typeof window === "undefined") return null;
  try {
    const db = await openDb();
    const rows = await new Promise<StoredRow[] | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(claimId);
      request.onsuccess = () => resolve(request.result as StoredRow[] | undefined);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!rows?.length) return null;
    const now = Date.now();
    const fresh = rows.filter((row) => now - row.savedAt < TTL_MS);
    if (fresh.length === 0) return null;
    return fresh.map(({ url, mimeType, fileName }) => ({
      url,
      mimeType,
      fileName,
    }));
  } catch {
    return null;
  }
}

export async function migrateIndexedReceiptPreviews(
  fromClaimId: string,
  toClaimId: string,
) {
  if (typeof window === "undefined" || fromClaimId === toClaimId) return;
  const rows = await readIndexedReceiptPreviews(fromClaimId);
  if (!rows) return;
  const now = Date.now();
  await writeIndexedReceiptPreviews(
    toClaimId,
    rows.map((row) => ({ ...row, savedAt: now })),
  );
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(fromClaimId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
