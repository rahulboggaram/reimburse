"use client";

import { useEffect, useState } from "react";
import { loadReceiptPreviewUrl } from "@/lib/compress-receipt-image";
import { textLinkClassName } from "@/components/text-link";
import { cn } from "@/lib/utils";

type Receipt = {
  id: string;
  url: string;
  fileName: string | null;
  mimeType: string;
};

function ReceiptLightbox(props: {
  receipt: Receipt;
  onClose: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setLoading(true);
    setFailed(false);
    setPreviewUrl(null);

    void loadReceiptPreviewUrl(props.receipt, { maxAttempts: 4 })
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) {
          setFailed(true);
          return;
        }
        if (!result.url) {
          setFailed(true);
          return;
        }
        objectUrl = result.url;
        setPreviewUrl(result.url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [props.receipt.id, props.receipt.url]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close"
          className="rounded-lg p-2 text-white/90 hover:bg-white/10"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {loading ? (
          <div className="size-12 animate-pulse rounded-full bg-white/20" />
        ) : failed || !previewUrl ? (
          <div className="max-w-sm rounded-xl bg-white px-6 py-8 text-center">
            <p className="text-sm font-medium text-zinc-900">
              {props.receipt.fileName ?? "Receipt"}
            </p>
            <a
              href={props.receipt.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("mt-3 inline-block text-sm", textLinkClassName)}
            >
              Open receipt
            </a>
          </div>
        ) : props.receipt.mimeType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob preview from authenticated fetch
          <img
            src={previewUrl}
            alt={props.receipt.fileName ?? "Receipt"}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          <div className="max-w-sm rounded-xl bg-white px-6 py-8 text-center">
            <p className="text-sm font-medium text-zinc-900">
              {props.receipt.fileName ?? "PDF receipt"}
            </p>
            <a
              href={props.receipt.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("mt-3 inline-block text-sm", textLinkClassName)}
            >
              Open PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptHeading(props: { title: string; count: number; hideCount?: boolean }) {
  return (
    <p className="text-xs font-medium text-zinc-500">
      {props.title}
      {!props.hideCount && props.count > 0 ? ` (${props.count})` : ""}
    </p>
  );
}

function AuthenticatedReceiptImage(props: {
  receipt: Receipt;
  className: string;
  onStatusChange?: (status: "loading" | "ready" | "pending" | "error") => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setStatus("loading");
    setPreviewUrl(null);
    props.onStatusChange?.("loading");

    void loadReceiptPreviewUrl(props.receipt, { maxAttempts: 4 })
      .then((result) => {
        if (cancelled) return;
        if ("error" in result || !result.url) {
          setStatus("error");
          props.onStatusChange?.("error");
          return;
        }
        objectUrl = result.url;
        setPreviewUrl(result.url);
        setStatus("ready");
        props.onStatusChange?.("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        props.onStatusChange?.("error");
      });

    return () => {
      cancelled = true;
      if (objectUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [props.receipt.id, props.receipt.url, props.onStatusChange]);

  if (status === "error") {
    return (
      <span className="flex size-full items-center justify-center px-1 text-center text-[10px] font-medium text-zinc-600">
        Tap to open
      </span>
    );
  }

  return (
    <>
      {status === "loading" ? (
        <span className="absolute inset-0 block animate-pulse bg-zinc-200" />
      ) : null}
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob preview from authenticated fetch
        <img
          src={previewUrl}
          alt={props.receipt.fileName ?? "Receipt"}
          className={props.className}
        />
      ) : null}
    </>
  );
}

export function ReceiptGallery(props: {
  receipts: Receipt[];
  receiptCount?: number;
  title?: string;
  compact?: boolean;
  loading?: boolean;
  hideCount?: boolean;
}) {
  const [expanded, setExpanded] = useState<Receipt | null>(null);
  const [receiptStatuses, setReceiptStatuses] = useState<
    Record<string, "loading" | "ready" | "pending" | "error">
  >({});

  useEffect(() => {
    setReceiptStatuses({});
  }, [props.receipts]);

  const count = props.receiptCount ?? props.receipts.length;
  const errorCount = Object.values(receiptStatuses).filter(
    (status) => status === "error",
  ).length;

  if (count === 0 && props.receipts.length === 0) return null;

  const heading = props.title ?? "Receipt photos";

  function handleStatusChange(
    receiptId: string,
    status: "loading" | "ready" | "pending" | "error",
  ) {
    setReceiptStatuses((prev) =>
      prev[receiptId] === status ? prev : { ...prev, [receiptId]: status },
    );
  }

  if (props.loading && props.receipts.length === 0 && props.compact) {
    return (
      <div className="space-y-2">
        <ReceiptHeading
          title={heading}
          count={count}
          hideCount={props.hideCount}
        />
        <ul className="flex flex-wrap gap-3" aria-busy="true" aria-label="Loading receipts">
          {Array.from({ length: count }, (_, index) => (
            <li key={index}>
              <div className="size-16 animate-pulse rounded-lg bg-zinc-200" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!props.compact) {
    return (
      <div className="space-y-2">
        <ReceiptHeading
          title={heading}
          count={count}
          hideCount={props.hideCount}
        />
        <ul className="grid grid-cols-2 gap-2">
          {props.receipts.map((receipt) => (
            <li key={receipt.id}>
              <button
                type="button"
                onClick={() => setExpanded(receipt)}
                className="relative block w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition-shadow hover:shadow-md"
              >
                {receipt.mimeType.startsWith("image/") ? (
                  <AuthenticatedReceiptImage
                    receipt={receipt}
                    className="aspect-[4/3] w-full object-cover"
                    onStatusChange={(status) => handleStatusChange(receipt.id, status)}
                  />
                ) : (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 px-2 text-center">
                    <span className="text-2xl" aria-hidden>
                      📄
                    </span>
                    <span className="line-clamp-2 text-xs font-medium text-zinc-700">
                      {receipt.fileName ?? "PDF receipt"}
                    </span>
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <ReceiptHeading
          title={heading}
          count={count}
          hideCount={props.hideCount}
        />
        <ul className="flex flex-wrap gap-3">
          {props.receipts.map((receipt) => (
            <li key={receipt.id}>
              <button
                type="button"
                onClick={() => setExpanded(receipt)}
                className="group relative size-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 transition-shadow hover:shadow-md"
              >
                {receipt.mimeType.startsWith("image/") ? (
                  <AuthenticatedReceiptImage
                    receipt={receipt}
                    className="size-full object-cover"
                    onStatusChange={(status) => handleStatusChange(receipt.id, status)}
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-lg">
                    📄
                  </span>
                )}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-900">
                    View
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {errorCount > 0 ? (
          <p className="text-xs text-amber-800">
            {errorCount === 1
              ? "One receipt could not be previewed. Tap it to open."
              : "Some receipts could not be previewed. Tap to open."}
          </p>
        ) : null}
      </div>
      {expanded ? (
        <ReceiptLightbox receipt={expanded} onClose={() => setExpanded(null)} />
      ) : null}
    </>
  );
}
