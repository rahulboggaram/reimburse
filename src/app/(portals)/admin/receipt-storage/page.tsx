"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";

type ReceiptStorageStatus = {
  storageMode:
    | "blob"
    | "database-fallback"
    | "blob-misconfigured"
    | "local-files";
  env: {
    runningOnVercel: boolean;
    blobReadWriteToken: boolean;
    blobStoreId: boolean;
    vercelOidcToken: boolean;
    enabled: boolean;
  };
  probe: { ok: boolean; error?: string } | null;
  recentReceipts: Array<{
    id: string;
    createdAt: string;
    fileName: string | null;
    employeeName: string;
    amount: number;
    storage: string;
  }>;
  summary: {
    recentSampleSize: number;
    blobCount: number;
    databaseCount: number;
  };
  nextSteps: string[];
};

function StatusRow(props: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex gap-3 text-sm">
      <span
        className={props.ok ? "text-emerald-700" : "text-amber-700"}
        aria-hidden
      >
        {props.ok ? "✓" : "○"}
      </span>
      <span>
        <span className="font-medium text-zinc-900">{props.label}</span>
        {props.detail ? (
          <span className="mt-0.5 block text-zinc-600">{props.detail}</span>
        ) : null}
      </span>
    </li>
  );
}

function modeLabel(mode: ReceiptStorageStatus["storageMode"]) {
  switch (mode) {
    case "blob":
      return "Blob storage — working";
    case "database-fallback":
      return "Database fallback — Blob not connected";
    case "blob-misconfigured":
      return "Blob linked but upload test failed";
    default:
      return "Local files (development)";
  }
}

export default function AdminReceiptStoragePage() {
  const [status, setStatus] = useState<ReceiptStorageStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/receipt-storage")
      .then((r) => readJson<ReceiptStorageStatus>(r))
      .then(setStatus)
      .catch(() => setError("Could not load receipt storage status."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeading
        title="Receipt storage"
        description="Check whether receipt photos are saving to Vercel Blob"
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
              {modeLabel(status.storageMode)}
            </p>
            <ul className="space-y-3">
              <StatusRow
                ok={status.env.runningOnVercel}
                label="Running on Vercel"
              />
              <StatusRow
                ok={status.env.blobReadWriteToken}
                label="BLOB_READ_WRITE_TOKEN"
                detail="Set when Blob store is connected to this project"
              />
              <StatusRow
                ok={status.env.blobStoreId}
                label="BLOB_STORE_ID"
                detail="Also set when Blob is connected (OIDC auth)"
              />
              <StatusRow
                ok={status.probe?.ok ?? false}
                label="Test upload to Blob"
                detail={
                  status.probe?.ok
                    ? "Succeeded"
                    : status.probe?.error ?? "Not run"
                }
              />
            </ul>
          </Card>

          <Card className="space-y-3">
            <p className="text-sm font-semibold text-zinc-900">
              Recent receipts (last {status.summary.recentSampleSize})
            </p>
            {status.recentReceipts.length === 0 ? (
              <p className="text-sm text-zinc-600">
                No receipts in the database yet. Submit a test claim to create
                one.
              </p>
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
                        row.storage === "blob"
                          ? "text-emerald-700"
                          : "text-amber-800"
                      }
                    >
                      {row.storage === "blob"
                        ? "saved in Blob"
                        : row.storage === "database"
                          ? "saved in database (not Blob)"
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
              If recent rows say “saved in database”, Blob was not active when
              those claims were submitted. Only new claims after Blob is fixed
              will appear under Storage → Browse.
            </p>
          </Card>

          <Card className="space-y-2">
            <p className="text-sm font-semibold text-zinc-900">What to do</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700">
              {status.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
        </>
      ) : null}
    </div>
  );
}
