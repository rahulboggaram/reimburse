"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/page-heading";
import { readJson } from "@/lib/api";

type FlowCheck = {
  id: string;
  label: string;
  ok: boolean;
  fix: string;
};

type ReceiptStorageStatus = {
  connected?: boolean;
  storageMode:
    | "blob"
    | "database-fallback"
    | "blob-misconfigured"
    | "local-files";
  flowChecks?: FlowCheck[];
  blobFilesInStorage?: number | null;
  totalReceiptRows?: number;
  blobLinkedRows?: number;
  env: {
    runningOnVercel: boolean;
    blobReadWriteToken: boolean;
    blobStoreId: boolean;
    vercelOidcToken: boolean;
    enabled: boolean;
    deploymentUrl?: string | null;
  };
  probe: { ok: boolean; error?: string } | null;
  latestBlobRead: { ok: boolean; bytes?: number; error?: string } | null;
  latestReceiptViewUrl: string | null;
  latestReceiptReadError?: string | null;
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
              {status.connected
                ? "Blob is connected and the receipt flow is working"
                : modeLabel(status.storageMode)}
            </p>
            {status.flowChecks ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Connection checklist
                </p>
                <ul className="space-y-3">
                  {status.flowChecks.map((check) => (
                    <li key={check.id} className="flex gap-3 text-sm">
                      <span
                        className={check.ok ? "text-emerald-700" : "text-amber-700"}
                        aria-hidden
                      >
                        {check.ok ? "✓" : "○"}
                      </span>
                      <span>
                        <span className="font-medium text-zinc-900">
                          {check.label}
                        </span>
                        {!check.ok ? (
                          <span className="mt-0.5 block text-amber-900">
                            {check.fix}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {typeof status.blobFilesInStorage === "number" ? (
              <p className="text-sm text-zinc-600">
                Files in Blob under <code className="text-xs">receipts/</code>:{" "}
                <strong>{status.blobFilesInStorage}</strong>
                {typeof status.blobLinkedRows === "number" ? (
                  <>
                    {" "}
                    · Database rows linked to Blob:{" "}
                    <strong>{status.blobLinkedRows}</strong>
                    {typeof status.totalReceiptRows === "number"
                      ? ` of ${status.totalReceiptRows} total`
                      : ""}
                  </>
                ) : null}
              </p>
            ) : null}
            {status.env.deploymentUrl ? (
              <p className="text-xs text-zinc-500">
                This status is for deployment: {status.env.deploymentUrl}
              </p>
            ) : null}
            {status.storageMode === "database-fallback" ? (
              <p className="text-sm text-amber-900">
                If Vercel Storage already shows &ldquo;Connected&rdquo;, the
                store is linked — but this live deployment still does not have
                Blob credentials. Redeploy Production (see steps below), then
                refresh this page.
              </p>
            ) : null}
            <ul className="space-y-3">
              <StatusRow
                ok={status.env.runningOnVercel}
                label="Running on Vercel"
              />
              <StatusRow
                ok={status.env.enabled}
                label="Blob credentials on this deployment"
                detail={
                  status.env.enabled
                    ? "The running app can talk to Blob"
                    : "Not available yet — redeploy after connecting the store"
                }
              />
              <StatusRow
                ok={status.env.blobReadWriteToken}
                label="BLOB_READ_WRITE_TOKEN"
                detail="Optional — Vercel may use BLOB_STORE_ID instead"
              />
              <StatusRow
                ok={status.env.blobStoreId}
                label="BLOB_STORE_ID"
                detail="Common on newer Vercel Blob setups"
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
              {status.latestBlobRead ? (
                <StatusRow
                  ok={status.latestBlobRead.ok}
                  label="Read latest saved receipt from Blob"
                  detail={
                    status.latestBlobRead.ok
                      ? `${status.latestBlobRead.bytes ?? 0} bytes loaded`
                      : status.latestBlobRead.error ?? "Failed"
                  }
                />
              ) : null}
            </ul>
            {status.latestReceiptViewUrl ? (
              <p className="text-xs text-zinc-600">
                Test the live receipt API:{" "}
                <a
                  href={status.latestReceiptViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-emerald-800 underline"
                >
                  open latest saved receipt
                </a>{" "}
                (should show a photo, not JSON error text).
              </p>
            ) : status.latestReceiptReadError ? (
              <p className="text-xs text-amber-900">
                Latest Blob receipt could not be read:{" "}
                <span className="font-medium">{status.latestReceiptReadError}</span>
                . Submit a new test claim after redeploying, or reconnect the Blob
                store.
              </p>
            ) : null}
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
