"use client";

import { useEffect, useState } from "react";
import { textLinkClassName } from "@/components/text-link";
import { cn } from "@/lib/utils";
import { isDirectReceiptUrl } from "@/lib/receipt-url";

type Receipt = {
  id: string;
  url: string;
  fileName: string | null;
  mimeType: string;
  previewFallbackUrl?: string;
};

function isPlaceholderReceipt(receipt: Receipt) {
  return (
    receipt.id.startsWith("placeholder-") ||
    (!receipt.url && !receipt.previewFallbackUrl)
  );
}

function resolveReceiptForView(
  receipt: Receipt,
  allReceipts: Receipt[],
): Receipt | null {
  if (!isPlaceholderReceipt(receipt)) {
    return receipt.url || receipt.previewFallbackUrl ? receipt : null;
  }

  const index = Number(receipt.id.split("-").pop());
  const loaded = allReceipts[index];
  if (loaded && !isPlaceholderReceipt(loaded)) {
    return loaded;
  }

  if (
    receipt.previewFallbackUrl &&
    isDirectReceiptUrl(receipt.previewFallbackUrl)
  ) {
    return receipt;
  }

  return null;
}

function ReceiptThumbnailTile(props: { fileName: string | null; isPdf: boolean }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-0.5 bg-zinc-100 text-zinc-500">
      {props.isPdf ? (
        <span className="text-lg" aria-hidden>
          📄
        </span>
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="size-5 text-zinc-400"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H5.25A2.25 2.25 0 0 0 3 5.25v13.5A2.25 2.25 0 0 0 5.25 21Z"
          />
        </svg>
      )}
      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-900 shadow-sm">
        View
      </span>
    </div>
  );
}

function ReceiptImage(props: {
  receipt: Receipt;
  className: string;
  onStatusChange?: (status: "loading" | "ready" | "pending" | "error") => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    setFailed(false);
    setSrc(null);
    props.onStatusChange?.("loading");

    const directSrc =
      props.receipt.previewFallbackUrl &&
      isDirectReceiptUrl(props.receipt.previewFallbackUrl)
        ? props.receipt.previewFallbackUrl
        : isDirectReceiptUrl(props.receipt.url)
          ? props.receipt.url
          : null;

    if (directSrc) {
      setSrc(directSrc);
      props.onStatusChange?.("ready");
      return () => {
        cancelled = true;
      };
    }

    void fetch(props.receipt.url, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? "Could not load receipt");
        }
        const type = response.headers.get("content-type") ?? "";
        if (type.includes("application/json")) {
          throw new Error("Receipt photo is missing");
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled || blob.size === 0) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        props.onStatusChange?.("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        props.onStatusChange?.("error");
      });

    return () => {
      cancelled = true;
      if (objectUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    props.receipt.id,
    props.receipt.url,
    props.receipt.previewFallbackUrl,
    props.onStatusChange,
  ]);

  if (failed && !src) {
    return (
      <span className="flex size-full items-center justify-center px-1 text-center text-[10px] font-medium text-zinc-600">
        Unavailable
      </span>
    );
  }

  if (!src) {
    return <span className="absolute inset-0 block animate-pulse bg-zinc-200" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={props.receipt.fileName ?? "Receipt"}
      className={props.className}
      onError={() => {
        setFailed(true);
        props.onStatusChange?.("error");
      }}
    />
  );
}

function ReceiptLightbox(props: {
  receipt: Receipt;
  allReceipts: Receipt[];
  onClose: () => void;
}) {
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(() =>
    resolveReceiptForView(props.receipt, props.allReceipts),
  );

  useEffect(() => {
    setViewReceipt(resolveReceiptForView(props.receipt, props.allReceipts));
  }, [props.receipt, props.allReceipts]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  const pending = !viewReceipt;

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
        {pending ? (
          <p className="text-sm text-white/80">Loading receipt…</p>
        ) : viewReceipt.mimeType.startsWith("image/") ? (
          <ReceiptImage
            receipt={viewReceipt}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          <div className="max-w-sm rounded-xl bg-white px-6 py-8 text-center">
            <p className="text-sm font-medium text-zinc-900">
              {viewReceipt.fileName ?? "PDF receipt"}
            </p>
            <a
              href={viewReceipt.url}
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
                  <ReceiptImage
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
        {props.receipts.length === 0 && count > 0 && !props.loading ? (
          <p className="text-xs text-zinc-500">Loading receipt photos…</p>
        ) : null}
        <ul className="flex flex-wrap gap-3">
          {props.receipts.map((receipt) => (
            <li key={receipt.id}>
              <button
                type="button"
                onClick={() => setExpanded(receipt)}
                aria-label={`View ${receipt.fileName ?? "receipt"}`}
                className="relative size-16 overflow-hidden rounded-lg border border-zinc-200 transition-shadow hover:shadow-md"
              >
                <ReceiptThumbnailTile
                  fileName={receipt.fileName}
                  isPdf={!receipt.mimeType.startsWith("image/")}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {expanded ? (
        <ReceiptLightbox
          receipt={expanded}
          allReceipts={props.receipts}
          onClose={() => setExpanded(null)}
        />
      ) : null}
    </>
  );
}
