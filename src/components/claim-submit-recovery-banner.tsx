"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/components/me-provider";
import {
  readClaimSubmitOutboxForUser,
  removeClaimSubmitOutboxEntry,
  subscribeClaimSubmitOutbox,
  type ClaimSubmitOutboxEntry,
} from "@/lib/claim-submit-outbox";
import { retryClaimSubmitOutboxEntry } from "@/lib/process-claim-submit-outbox";

export function ClaimSubmitRecoveryBanner() {
  const { user } = useMe();
  const [entries, setEntries] = useState<ClaimSubmitOutboxEntry[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setEntries([]);
      return;
    }
    const rows = await readClaimSubmitOutboxForUser(user.id);
    setEntries(rows.filter((row) => row.status === "failed"));
  }, [user?.id]);

  useEffect(() => {
    void refresh();
    return subscribeClaimSubmitOutbox(() => {
      void refresh();
    });
  }, [refresh]);

  if (!user?.id || entries.length === 0) return null;

  async function retry(entry: ClaimSubmitOutboxEntry) {
    setRetryingId(entry.id);
    try {
      await retryClaimSubmitOutboxEntry(entry);
      await refresh();
    } finally {
      setRetryingId(null);
    }
  }

  async function dismiss(entry: ClaimSubmitOutboxEntry) {
    await removeClaimSubmitOutboxEntry(entry.id);
    await refresh();
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950"
        >
          <p className="font-medium">
            {entries.length === 1
              ? "A claim with receipt photos did not finish uploading."
              : "Some claims with receipt photos did not finish uploading."}
          </p>
          <p className="mt-1 text-amber-900">
            ₹{entry.amount.toLocaleString("en-IN")} · {entry.category}
            {entry.lastError ? ` — ${entry.lastError}` : ""}
          </p>
          <p className="mt-1 text-amber-800">
            Your photos are saved on this device. Tap Retry — this is usually
            the cloud database waking up, not your internet speed.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={retryingId === entry.id}
              onClick={() => void retry(entry)}
            >
              {retryingId === entry.id ? "Retrying…" : "Retry upload"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={retryingId === entry.id}
              onClick={() => void dismiss(entry)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
