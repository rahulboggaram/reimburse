import { fetchMyClaims } from "@/lib/fetch-own-claims";
import {
  buildClaimFormDataFromOutbox,
  markClaimSubmitOutboxFailed,
  markClaimSubmitOutboxSuccess,
  markClaimSubmitOutboxUploading,
  readRetryableClaimSubmitOutbox,
  type ClaimSubmitOutboxEntry,
} from "@/lib/claim-submit-outbox";
import {
  failPendingClaimSubmit,
  registerPendingClaimSubmit,
  resolvePendingClaimSubmit,
} from "@/lib/pending-claim-submit";
import { migrateLocalReceiptPreviews, stashLocalReceiptPreviews } from "@/lib/local-receipt-previews";
import { submitClaimWithRetry } from "@/lib/submit-claim-request";

let processing = false;

function pendingFromOutbox(entry: ClaimSubmitOutboxEntry) {
  return {
    tempId: entry.id,
    userId: entry.userId,
    amount: entry.amount,
    category: entry.category,
    description: entry.description,
    branchId: entry.branchId,
    branchName: entry.branchName,
    employeeName: entry.employeeName,
    employeePhone: entry.employeePhone,
    employeeRole: entry.employeeRole,
    receiptCount: entry.receipts.length,
    claimStatus: entry.claimStatus,
    state: entry.status === "failed" ? ("failed" as const) : ("uploading" as const),
    error: entry.lastError,
    submittedAt: entry.createdAt,
  };
}

async function stashOutboxPreviews(entry: ClaimSubmitOutboxEntry) {
  const previewClaimId = entry.serverClaimId ?? entry.refileClaimId ?? entry.id;
  if (entry.receipts.length === 0) return;

  const items = entry.receipts.map((receipt) => {
    const file = new File([receipt.blob], receipt.name, {
      type: receipt.type || receipt.blob.type || "application/octet-stream",
      lastModified: Date.now(),
    });
    return {
      previewUrl: URL.createObjectURL(file),
      file,
    };
  });

  await stashLocalReceiptPreviews(previewClaimId, items);
  for (const item of items) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

export async function retryClaimSubmitOutboxEntry(entry: ClaimSubmitOutboxEntry) {
  await markClaimSubmitOutboxUploading(entry.id);
  registerPendingClaimSubmit(pendingFromOutbox(entry));
  await stashOutboxPreviews(entry);

  const url =
    entry.kind === "refile" && entry.refileClaimId
      ? `/api/claims/${entry.refileClaimId}/refile`
      : "/api/claims";
  const method = entry.kind === "refile" ? "PATCH" : "POST";

  try {
    const created = await submitClaimWithRetry({
      url,
      method,
      buildFormData: () => buildClaimFormDataFromOutbox(entry),
      clientSubmitId: entry.kind === "create" ? entry.id : undefined,
      maxAttempts: 5,
    });

    const claimId = created.id;
    if (entry.kind === "create") {
      migrateLocalReceiptPreviews(entry.id, claimId);
    } else {
      await stashOutboxPreviews({ ...entry, serverClaimId: claimId });
    }

    await markClaimSubmitOutboxSuccess(entry.id, claimId);
    resolvePendingClaimSubmit(entry.userId, entry.id);
    await fetchMyClaims(entry.userId, { fresh: true }).catch(() => {});
    return { ok: true as const, claimId };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not save claim. Check your connection and try again.";
    await markClaimSubmitOutboxFailed(entry.id, message);
    failPendingClaimSubmit(entry.userId, entry.id, message);
    return { ok: false as const, error: message };
  }
}

export async function processClaimSubmitOutbox(userId: string) {
  if (processing || typeof window === "undefined") return;
  processing = true;

  try {
    const entries = await readRetryableClaimSubmitOutbox(userId);
    for (const entry of entries) {
      await retryClaimSubmitOutboxEntry(entry);
    }
  } finally {
    processing = false;
  }
}
