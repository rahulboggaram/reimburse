"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";

type ReceiptStorageStatus = {
  stats: {
    total: number;
    inDatabase: number;
    inSupabaseStorage: number;
    localFiles: number;
    storageBackend: "supabase" | "database";
    unavailable: number;
  };
  recentReceipts: Array<{
    id: string;
    createdAt: string;
    fileName: string | null;
    employeeName: string;
    amount: number;
    storage: "database" | "local" | "supabase";
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
        description={
          status?.stats.storageBackend === "supabase"
            ? "New receipts are stored in Supabase Storage. Older rows may still be in the database."
            : "Receipts are stored in the database until Supabase Storage env vars are set on Vercel."
        }
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
            <p className="text-sm font-semibold text-zinc-900">
              Database storage
            </p>
            <ul className="space-y-2 text-sm text-zinc-700">
              {status.stats.storageBackend === "supabase" ? (
                <li>
                  <strong>{status.stats.inSupabaseStorage}</strong> receipt photos
                  in Supabase Storage
                </li>
              ) : null}
              <li>
                <strong>{status.stats.inDatabase}</strong> receipt photos stored
                as database blobs (legacy)
              </li>
              <li>
                <strong>{status.stats.total}</strong> total receipt rows
              </li>
              {status.stats.unavailable > 0 ? (
                <li className="text-amber-900">
                  <strong>{status.stats.unavailable}</strong> missing or
                  unreadable — ask the employee to refile those claims
                </li>
              ) : null}
            </ul>
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
                    · ₹{row.amount}
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {new Date(row.createdAt).toLocaleString("en-IN")} ·{" "}
                      {row.fileName ?? "receipt"} · {row.storage}
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
