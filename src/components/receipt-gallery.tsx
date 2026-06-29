"use client";

import { useEffect, useState } from "react";
import { textLinkClassName } from "@/components/text-link";
import { LoadingDots } from "@/components/ui/loading-dots";
import { openReceiptInNewTab } from "@/lib/compress-receipt-image";
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
    receipt.id.startsWith("local-") ||
    (!receipt.url && !receipt.previewFallbackUrl)
  );
}

function isRealReceiptId(receipt: Receipt) {
  return (
    !receipt.id.startsWith("placeholder-") &&
    !receipt.id.startsWith("local-")
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

function receiptApiPath(receipt: Receipt) {
  return receipt.url.startsWith("/api/receipts/") ? receipt.url : null;
}

function getLocalPreviewSrc(receipt: Receipt): string | null {
  if (
    receipt.previewFallbackUrl &&
    isDirectReceiptUrl(receipt.previewFallbackUrl)
  ) {
    return receipt.previewFallbackUrl;
  }

  if (receipt.url && isDirectReceiptUrl(receipt.url)) {
    return receipt.url;
  }

  return null;
}

function receiptDisplaySrc(receipt: Receipt) {
  return getLocalPreviewSrc(receipt) ?? receiptApiPath(receipt);
}

type ReceiptStatus = {
  ok?: boolean;
  step?: string;
  storage?: string;
  error?: string;
};

async function fetchReceiptStatus(receiptId: string): Promise<ReceiptStatus | null> {
  try {
    const response = await fetch(`/api/receipts/${receiptId}/status`, {
      credentials: "include",
      cache: "no-store",
    });
    return (await response.json()) as ReceiptStatus;
  } catch {
    return null;
  }
}

function ReceiptThumbnailTile(props: { isPdf: boolean; loading?: boolean }) {
  if (props.loading) {
    return (
      <span className="flex size-full items-center justify-center bg-zinc-100 text-zinc-500">
        <LoadingDots />
      </span>
    );
  }

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

function ReceiptImageError(props: {
  receipt: Receipt;
  compact?: boolean;
  message?: string;
}) {
  return (
    <span className="flex size-full flex-col items-center justify-center gap-1 px-1 text-center">
      <span
        className={cn(
          "font-medium text-zinc-600",
          props.compact ? "text-[10px]" : "text-xs",
        )}
      >
        {props.message ?? "Couldn\u2019t preview"}
      </span>
      {props.receipt.url ? (
        <button
          type="button"
          className={cn(
            "text-blue-600 underline",
            props.compact ? "text-[10px]" : "text-xs",
          )}
          onClick={(event) => {
            event.stopPropagation();
            void openReceiptInNewTab({
              url: props.receipt.url,
              mimeType: props.receipt.mimeType,
              fileName: props.receipt.fileName,
            });
          }}
        >
          Open photo
        </button>
      ) : null}
    </span>
  );
}

function ReceiptImage(props: {
  receipt: Receipt;
  className: string;
  compact?: boolean;
}) {
  const localPreview = getLocalPreviewSrc(props.receipt);
  const apiPath = receiptApiPath(props.receipt);
  const [src, setSrc] = useState(() => receiptDisplaySrc(props.receipt));
  const [failed, setFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    setSrc(receiptDisplaySrc(props.receipt));
    setFailed(false);
    setErrorMessage(undefined);
  }, [props.receipt.id, props.receipt.url, props.receipt.previewFallbackUrl]);

  async function handleImageError() {
    if (localPreview && src !== localPreview) {
      setSrc(localPreview);
      return;
    }

    if (apiPath && src !== apiPath) {
      setSrc(apiPath);
      return;
    }

    if (isRealReceiptId(props.receipt)) {
      const status = await fetchReceiptStatus(props.receipt.id);
      if (status?.error) {
        setErrorMessage(status.error);
      } else if (status?.ok === false) {
        setErrorMessage("Receipt photo is missing on the server. Refile this claim.");
      }
    }

    setFailed(true);
  }

  if (!src) {
    return <ReceiptThumbnailTile isPdf={false} loading />;
  }

  if (failed) {
    return (
      <ReceiptImageError
        receipt={props.receipt}
        compact={props.compact}
        message={errorMessage}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={props.receipt.fileName ?? "Receipt"}
      decoding="async"
      className={props.className}
      onError={() => {
        void handleImageError();
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

  if (!viewReceipt) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
        <LoadingDots className="text-white" />
      </div>
    );
  }

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
        {viewReceipt.mimeType.startsWith("image/") ? (
          <ReceiptImage
            receipt={viewReceipt}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          <div className="max-w-sm rounded-xl bg-white px-6 py-8 text-center">
            <p className="text-sm font-medium text-zinc-900">
              {viewReceipt.fileName ?? "PDF receipt"}
            </p>
            <button
              type="button"
              className={cn("mt-3 text-sm", textLinkClassName)}
              onClick={() =>
                void openReceiptInNewTab({
                  url: viewReceipt.url,
                  mimeType: viewReceipt.mimeType,
                  fileName: viewReceipt.fileName,
                })
              }
            >
              Open PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptCompactThumbnail(props: { receipt: Receipt }) {
  if (!props.receipt.mimeType.startsWith("image/")) {
    return (
      <ReceiptThumbnailTile
        isPdf={!props.receipt.mimeType.startsWith("image/")}
      />
    );
  }

  if (isPlaceholderReceipt(props.receipt) && !props.receipt.previewFallbackUrl) {
    return <ReceiptThumbnailTile isPdf={false} loading />;
  }

  return (
    <>
      <ReceiptImage
        receipt={props.receipt}
        compact
        className="size-full object-cover"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-zinc-900">
          View
        </span>
      </span>
    </>
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

function ReceiptLoadingTiles(props: { count: number }) {
  return (
    <ul className="flex flex-wrap gap-3" aria-busy="true" aria-label="Loading receipts">
      {Array.from({ length: props.count }, (_, index) => (
        <li key={index}>
          <div className="flex size-16 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-500">
            <LoadingDots />
          </div>
        </li>
      ))}
    </ul>
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

  const hasDisplayableReceipt = props.receipts.some(
    (receipt) =>
      !isPlaceholderReceipt(receipt) || Boolean(receipt.previewFallbackUrl),
  );

  const showLoadingTiles =
    props.compact && !hasDisplayableReceipt && (props.loading || count > 0);

  if (showLoadingTiles) {
    return (
      <div className="space-y-2">
        <ReceiptHeading
          title={heading}
          count={count}
          hideCount={props.hideCount}
        />
        <ReceiptLoadingTiles count={Math.max(count, 1)} />
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
        {expanded ? (
          <ReceiptLightbox
            receipt={expanded}
            allReceipts={props.receipts}
            onClose={() => setExpanded(null)}
          />
        ) : null}
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
                aria-label={`View ${receipt.fileName ?? "receipt"}`}
                className="group relative size-16 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 transition-shadow hover:shadow-md"
              >
                <ReceiptCompactThumbnail receipt={receipt} />
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
