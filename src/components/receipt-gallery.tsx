"use client";

import { useState } from "react";
import { textLinkClassName } from "@/components/text-link";
import { LoadingDots } from "@/components/ui/loading-dots";
import { cn } from "@/lib/utils";

type Receipt = {
  id: string;
  url: string;
  fileName: string | null;
  mimeType: string;
};

function isWaitingForReceipt(receipt: Receipt) {
  return receipt.id.startsWith("placeholder-") || !receipt.url;
}

function ReceiptImage(props: { receipt: Receipt; className: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);

  if (isWaitingForReceipt(props.receipt)) {
    return (
      <span className="flex size-full items-center justify-center bg-zinc-100 text-zinc-500">
        <LoadingDots />
      </span>
    );
  }

  if (failed) {
    return (
      <span className="flex size-full flex-col items-center justify-center gap-1 px-1 text-center">
        <span
          className={cn(
            "font-medium text-zinc-600",
            props.compact ? "text-[10px]" : "text-xs",
          )}
        >
          Photo missing — refile this claim
        </span>
        <a
          href={props.receipt.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-blue-600 underline",
            props.compact ? "text-[10px]" : "text-xs",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          Try opening
        </a>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={props.receipt.url}
      alt={props.receipt.fileName ?? "Receipt"}
      className={props.className}
      onError={() => setFailed(true)}
    />
  );
}

function ReceiptLightbox(props: {
  receipt: Receipt;
  onClose: () => void;
}) {
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
        {props.receipt.mimeType.startsWith("image/") ? (
          <ReceiptImage
            receipt={props.receipt}
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

export function ReceiptGallery(props: {
  receipts: Receipt[];
  receiptCount?: number;
  title?: string;
  compact?: boolean;
  loading?: boolean;
  hideCount?: boolean;
}) {
  const [expanded, setExpanded] = useState<Receipt | null>(null);
  const count = props.receiptCount ?? props.receipts.length;

  if (count === 0 && props.receipts.length === 0) return null;

  const title = props.title ?? "Receipt photos";
  const waiting =
    props.loading || props.receipts.length === 0 || props.receipts.every(isWaitingForReceipt);

  if (waiting) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">{title}</p>
        <div
          className={cn(
            "flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-500",
            props.compact ? "size-16" : "aspect-[4/3] w-full max-w-[8rem]",
          )}
        >
          <LoadingDots />
        </div>
      </div>
    );
  }

  const tileClass = props.compact
    ? "size-16"
    : "aspect-[4/3] w-full";

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">
          {title}
          {!props.hideCount && count > 0 ? ` (${count})` : ""}
        </p>
        <ul className={cn(props.compact ? "flex flex-wrap gap-3" : "grid grid-cols-2 gap-2")}>
          {props.receipts.map((receipt) => (
            <li key={receipt.id}>
              <button
                type="button"
                onClick={() => setExpanded(receipt)}
                aria-label={`View ${receipt.fileName ?? "receipt"}`}
                className={cn(
                  "group relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 transition-shadow hover:shadow-md",
                  tileClass,
                  !props.compact && "w-full rounded-xl",
                )}
              >
                {receipt.mimeType.startsWith("image/") ? (
                  <ReceiptImage
                    receipt={receipt}
                    compact={props.compact}
                    className="size-full object-cover"
                  />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-zinc-600">
                    <span className="text-lg" aria-hidden>
                      📄
                    </span>
                    {receipt.fileName ?? "PDF"}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {expanded ? (
        <ReceiptLightbox receipt={expanded} onClose={() => setExpanded(null)} />
      ) : null}
    </>
  );
}
