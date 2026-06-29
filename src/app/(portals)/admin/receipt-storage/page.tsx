"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";

type ReceiptStorageStatus = {
  stats: {
    total: number;
    inStorage: number;
    legacyText: number;
    localFiles: number;
    storageConfigured: boolean;
  };
  recentReceipts: Array<{
    id: string;
    createdAt: string;
    fileName: string | null;
    employeeName: string;
    amount: number;
    storage: string;
    previewOk: boolean;
    previewError: string | null;
  }>;
};

type CleanupPreview = {
  totalToday: number;
  keep: {
    id: string;
    createdAt: string;
    amount: number;
    category: string;
    employeeName: string;
    status: string;
  } | null;
  toDelete: Array<{
    id: string;
    createdAt: string;
    amount: number;
    category: string;
    employeeName: string;
    status: string;
    receiptCount: number;
  }>;
  deletedCount?: number;
  error?: string;
  message?: string;
};

export default function AdminReceiptStoragePage() {
  const [status, setStatus] = useState<ReceiptStorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleanup, setCleanup] = useState<CleanupPreview | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/receipt-storage")
      .then((response) => readJson<ReceiptStorageStatus>(response))
      .then(setStatus)
      .catch(() => setError("Could not load receipt status."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function previewCleanup() {
    setCleanupLoading(true);
    setCleanupMessage(null);
    try {
      const response = await fetch("/api/admin/cleanup-today-test-claims");
      const data = await readJson<CleanupPreview>(response);
      setCleanup(data);
    } catch {
      setCleanupMessage("Could not load cleanup preview.");
    } finally {
      setCleanupLoading(false);
    }
  }

  async function runCleanup() {
    if (
      !cleanup ||
      cleanup.toDelete.length === 0 ||
      !window.confirm(
        `Delete ${cleanup.toDelete.length} test claim(s) from today? The latest claim with working photos will be kept.`,
      )
    ) {
      return;
    }

    setCleanupLoading(true);
    setCleanupMessage(null);
    try {
      const response = await fetch("/api/admin/cleanup-today-test-claims?execute=1", {
        method: "POST",
      });
      const data = await readJson<CleanupPreview>(response);
      setCleanup(data);
      setCleanupMessage(
        data.error ??
          (data.deletedCount
            ? `Removed ${data.deletedCount} claim(s).`
            : "Nothing to remove."),
      );
      loadStatus();
    } catch {
      setCleanupMessage("Cleanup failed.");
    } finally {
      setCleanupLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Receipt photos"
        description="Photos are stored in Supabase Storage. The database only keeps the file path."
      />

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : status ? (
        <>
          <Card className="space-y-4">
            <p className="text-sm font-semibold text-zinc-900">Storage</p>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>
                Supabase configured on Vercel:{" "}
                <strong>{status.stats.storageConfigured ? "yes" : "no"}</strong>
              </li>
              <li>
                <strong>{status.stats.inStorage}</strong> in Supabase Storage
              </li>
              <li>
                <strong>{status.stats.legacyText}</strong> legacy broken text rows
              </li>
              <li>
                <strong>{status.stats.total}</strong> total
              </li>
            </ul>
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-semibold text-zinc-900">
              Clean up today&apos;s test claims
            </p>
            <p className="text-sm text-zinc-600">
              Removes claims submitted today (IST) except the most recent one that
              has working receipt photos.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={previewCleanup}
                disabled={cleanupLoading}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                {cleanupLoading ? "Working…" : "Preview"}
              </button>
              <button
                type="button"
                onClick={runCleanup}
                disabled={cleanupLoading || !cleanup || cleanup.toDelete.length === 0}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                Remove test claims
              </button>
            </div>
            {cleanupMessage ? (
              <p className="text-sm text-zinc-700" role="status">
                {cleanupMessage}
              </p>
            ) : null}
            {cleanup ? (
              <div className="space-y-2 text-sm text-zinc-700">
                <p>
                  <strong>{cleanup.totalToday}</strong> claim(s) today ·{" "}
                  <strong>{cleanup.toDelete.length}</strong> to remove
                </p>
                {cleanup.keep ? (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">
                    Keeping: {cleanup.keep.employeeName} · ₹{cleanup.keep.amount} ·{" "}
                    {new Date(cleanup.keep.createdAt).toLocaleString("en-IN")}
                  </p>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
                    No claim today has working receipt photos.
                  </p>
                )}
                {cleanup.toDelete.length > 0 ? (
                  <ul className="space-y-1">
                    {cleanup.toDelete.map((row) => (
                      <li key={row.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                        {row.employeeName} · ₹{row.amount} ·{" "}
                        {new Date(row.createdAt).toLocaleString("en-IN")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-semibold text-zinc-900">Recent receipts</p>
            {status.recentReceipts.length === 0 ? (
              <p className="text-sm text-zinc-600">No receipts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm text-zinc-700">
                {status.recentReceipts.map((row) => (
                  <li key={row.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                    <span className="font-medium text-zinc-900">
                      {row.employeeName}
                    </span>{" "}
                    · ₹{row.amount}
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {new Date(row.createdAt).toLocaleString("en-IN")} · {row.storage}
                      {row.previewOk ? (
                        <span className="text-emerald-700"> · loads OK</span>
                      ) : (
                        <span className="text-red-700">
                          {" "}
                          · {row.previewError ?? "failed"}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
