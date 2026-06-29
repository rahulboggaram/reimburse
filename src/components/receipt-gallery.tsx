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

function ReceiptPhoto(props: {
  receipt: Receipt;
  className: string;
  compact?: boolean;
}) {
  const [broken, setBroken] = useState(false);

  if (!props.receipt.url) {
    return (
      <span className="flex size-full items-center justify-center bg-zinc-100 text-zinc-500">
        <LoadingDots />
      </span>
    );
  }

  if (broken) {
    return (
      <span className="flex size-full flex-col items-center justify-center gap-1 px-1 text-center">
        <span
          className={cn(
            "font-medium text-zinc-600",
            props.compact ? "text-[10px]" : "text-xs",
          )}
        >
          Could not load photo
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
          Open directly
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
      onError={() => setBroken(true)}
    />
  );
}

function ReceiptLightbox(props: { receipt: Receipt; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close"
          className="rounded-lg p-2 text-white/90 hover:bg-white/10"
        >
          ✕
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {props.receipt.mimeType.startsWith("image/") ? (
          <ReceiptPhoto
            receipt={props.receipt}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          <a
            href={props.receipt.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("rounded-xl bg-white px-6 py-4 text-sm", textLinkClassName)}
          >
            Open {props.receipt.fileName ?? "PDF"}
          </a>
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

  if (props.loading || props.receipts.length === 0) {
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

  const tileClass = props.compact ? "size-16" : "aspect-[4/3] w-full";

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
                className={cn(
                  "relative overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 hover:shadow-md",
                  tileClass,
                  !props.compact && "w-full rounded-xl",
                )}
              >
                <ReceiptPhoto
                  receipt={receipt}
                  compact={props.compact}
                  className="size-full object-cover"
                />
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
