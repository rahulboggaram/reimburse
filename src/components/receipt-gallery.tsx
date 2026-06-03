"use client";

import { useEffect, useState } from "react";
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
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

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
          // eslint-disable-next-line @next/next/no-img-element -- receipt preview
          <img
            src={props.receipt.url}
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

  const heading = props.title ?? "Receipt photos";

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
              <a
                href={receipt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 transition-shadow hover:shadow-md"
              >
                {receipt.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={receipt.url}
                    alt={receipt.fileName ?? "Receipt"}
                    className="aspect-[4/3] w-full object-cover"
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
              </a>
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={receipt.url}
                    alt={receipt.fileName ?? "Receipt"}
                    className="size-full object-cover"
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
      </div>
      {expanded ? (
        <ReceiptLightbox receipt={expanded} onClose={() => setExpanded(null)} />
      ) : null}
    </>
  );
}
