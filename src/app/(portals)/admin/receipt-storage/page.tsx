"use client";

import { useEffect, useState } from "react";
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

export default function AdminReceiptStoragePage() {
  const [status, setStatus] = useState<ReceiptStorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/receipt-storage")
      .then((response) => readJson<ReceiptStorageStatus>(response))
      .then(setStatus)
      .catch(() => setError("Could not load receipt status."))
      .finally(() => setLoading(false));
  }, []);

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
