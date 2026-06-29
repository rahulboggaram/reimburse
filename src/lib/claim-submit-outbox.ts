export type ClaimSubmitReceiptBlob = {
  name: string;
  type: string;
  blob: Blob;
};

export type ClaimSubmitOutboxEntry = {
  id: string;
  userId: string;
  kind: "create" | "refile";
  refileClaimId?: string;
  amount: number;
  category: string;
  description: string;
  branchId: string;
  branchName: string;
  employeeName: string;
  employeePhone: string;
  employeeRole: string;
  claimStatus: "PENDING" | "APPROVED";
  receipts: ClaimSubmitReceiptBlob[];
  status: "queued" | "uploading" | "failed";
  serverClaimId?: string;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = "reimburse-claim-outbox";
const STORE = "submits";
const DB_VERSION = 1;
const OUTBOX_EVENT = "claim-submit-outbox-changed";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

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

function notifyOutboxChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

async function readAllEntries(): Promise<ClaimSubmitOutboxEntry[]> {
  if (typeof window === "undefined") return [];
  try {
    const db = await openDb();
    const rows = await new Promise<ClaimSubmitOutboxEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () =>
        resolve((request.result as ClaimSubmitOutboxEntry[]) ?? []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    const now = Date.now();
    return rows.filter((row) => now - row.createdAt < MAX_AGE_MS);
  } catch {
    return [];
  }
}

async function writeEntry(entry: ClaimSubmitOutboxEntry) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry, entry.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  notifyOutboxChanged();
}

async function deleteEntry(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  notifyOutboxChanged();
}

export function subscribeClaimSubmitOutbox(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OUTBOX_EVENT, listener);
  return () => window.removeEventListener(OUTBOX_EVENT, listener);
}

export async function enqueueClaimSubmitOutbox(
  entry: Omit<
    ClaimSubmitOutboxEntry,
    "status" | "attempts" | "createdAt" | "updatedAt"
  >,
) {
  const now = Date.now();
  await writeEntry({
    ...entry,
    status: "uploading",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function markClaimSubmitOutboxSuccess(
  id: string,
  serverClaimId: string,
) {
  await deleteEntry(id);
  void serverClaimId;
}

export async function markClaimSubmitOutboxFailed(
  id: string,
  error: string,
  options?: { serverClaimId?: string },
) {
  const rows = await readAllEntries();
  const existing = rows.find((row) => row.id === id);
  if (!existing) return;

  await writeEntry({
    ...existing,
    status: "failed",
    serverClaimId: options?.serverClaimId ?? existing.serverClaimId,
    lastError: error,
    attempts: existing.attempts + 1,
    updatedAt: Date.now(),
  });
}

export async function markClaimSubmitOutboxUploading(id: string) {
  const rows = await readAllEntries();
  const existing = rows.find((row) => row.id === id);
  if (!existing) return;

  await writeEntry({
    ...existing,
    status: "uploading",
    updatedAt: Date.now(),
  });
}

export async function readClaimSubmitOutboxForUser(userId: string) {
  const rows = await readAllEntries();
  return rows
    .filter((row) => row.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readRetryableClaimSubmitOutbox(userId: string) {
  const rows = await readClaimSubmitOutboxForUser(userId);
  return rows.filter(
    (row) => row.status === "failed" || row.status === "uploading",
  );
}

export async function removeClaimSubmitOutboxEntry(id: string) {
  await deleteEntry(id);
}

export function buildClaimFormDataFromOutbox(entry: ClaimSubmitOutboxEntry) {
  const formData = new FormData();
  formData.set("amount", String(entry.amount));
  formData.set("category", entry.category);
  formData.set("description", entry.description);
  formData.set("clientSubmitId", entry.id);
  for (const receipt of entry.receipts) {
    const file = new File([receipt.blob], receipt.name, {
      type: receipt.type || receipt.blob.type || "application/octet-stream",
      lastModified: Date.now(),
    });
    formData.append("receipts", file);
  }
  return formData;
}
