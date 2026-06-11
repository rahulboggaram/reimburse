"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { readJson } from "@/lib/api";

type ReceiptStorageStatus = {
  stats: {
    total: number;
    inDatabase: number;
    legacyBlob: number;
    localFiles: number;
  };
  blobFilesRemaining: number | null;
  recentReceipts: Array<{
    id: string;
    createdAt: string;
    fileName: string | null;
    employeeName: string;
    amount: number;
    storage: "database" | "legacy-blob" | "local-file";
  }>;
};

type CleanupResult = {
  ok: boolean;
  migrated: number;
  migrateFailed: number;
  blobFilesDeleted: number;
  purgeError?: string;
  stats: ReceiptStorageStatus["stats"];
  blobFilesRemaining: number | null;
};

export default function AdminReceiptStoragePage() {
  const [status, setStatus] = useState<ReceiptStorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  async function loadStatus() {
    const response = await fetch("/api/admin/receipt-storage");
    const data = await readJson<ReceiptStorageStatus>(response);
    setStatus(data);
  }

  useEffect(() => {
    loadStatus()
      .catch(() => setError("Could not load receipt status."))
      .finally(() => setLoading(false));
  }, []);

  async function runCleanup() {
    setCleaning(true);
    setCleanupMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/receipt-storage", {
        method: "POST",
      });
      const result = await readJson<CleanupResult>(response);
      setStatus({
        stats: result.stats,
        blobFilesRemaining: result.blobFilesRemaining,
        recentReceipts: status?.recentReceipts ?? [],
      });
      await loadStatus();

      if (result.ok) {
        setCleanupMessage(
          `Done. Moved ${result.migrated} receipt(s) to the database and removed ${result.blobFilesDeleted} file(s) from Vercel Blob.`,
        );
      } else {
        const parts = [
          `Moved ${result.migrated} to the database.`,
          result.migrateFailed > 0
            ? `${result.migrateFailed} could not be moved — refile those claims.`
            : null,
          result.blobFilesDeleted > 0
            ? `Removed ${result.blobFilesDeleted} Blob file(s).`
            : null,
          result.purgeError ? `Blob cleanup: ${result.purgeError}` : null,
        ].filter(Boolean);
        setCleanupMessage(parts.join(" "));
      }
    } catch {
      setError("Cleanup failed. Try again in a moment.");
    } finally {
      setCleaning(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Receipt photos"
        description="Receipts are stored in the database. Vercel Blob is no longer used."
      />

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {cleanupMessage ? (
        <p className="text-sm text-emerald-900" role="status">
          {cleanupMessage}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : status ? (
        <>
          <Card className="space-y-4">
            <p className="text-sm font-semibold text-zinc-900">
              Database storage
            </p>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li>
                <strong>{status.stats.inDatabase}</strong> receipt photos in
                the database (active)
              </li>
              <li>
                <strong>{status.stats.total}</strong> total receipt rows
              </li>
              {status.stats.legacyBlob > 0 ? (
                <li className="text-amber-900">
                  <strong>{status.stats.legacyBlob}</strong> still pointing at
                  old Vercel Blob — run cleanup below
                </li>
              ) : null}
              {typeof status.blobFilesRemaining === "number" &&
              status.blobFilesRemaining > 0 ? (
                <li className="text-amber-900">
                  <strong>{status.blobFilesRemaining}</strong> file(s) still in
                  Vercel Blob storage
                </li>
              ) : null}
            </ul>

            {(status.stats.legacyBlob > 0 ||
              (status.blobFilesRemaining ?? 0) > 0) && (
              <div className="space-y-2 border-t border-zinc-100 pt-4">
                <p className="text-sm text-zinc-600">
                  Move any remaining Blob receipts into the database, then empty
                  Vercel Blob storage.
                </p>
                <Button
                  type="button"
                  onClick={() => void runCleanup()}
                  disabled={cleaning}
                >
                  {cleaning ? "Cleaning up…" : "Move to database & clear Blob"}
                </Button>
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-semibold text-zinc-900">
              Recent receipts
            </p>
            {status.recentReceipts.length === 0 ? (
              <p className="text-sm text-zinc-600">No receipts yet.</p>
            ) : (
              <ul className="space-y-2 text-sm text-zinc-700">
                {status.recentReceipts.map((row) => (
                  <li key={row.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                    <span className="font-medium text-zinc-900">
                      {row.employeeName}
                    </span>{" "}
                    · ₹{row.amount} ·{" "}
                    <span
                      className={
                        row.storage === "database"
                          ? "text-emerald-700"
                          : "text-amber-800"
                      }
                    >
                      {row.storage === "database"
                        ? "database"
                        : row.storage === "legacy-blob"
                          ? "legacy Blob (needs cleanup)"
                          : row.storage}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {new Date(row.createdAt).toLocaleString("en-IN")} ·{" "}
                      {row.fileName ?? "receipt"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-zinc-500">
              Only rows marked &ldquo;database&rdquo; are used for thumbnails.
              New claims always save to the database.
            </p>
          </Card>
        </>
      ) : null}
    </div>
  );
}
