"use client";

import { useEffect, useId, useRef, useState } from "react";
import { compressReceiptFile } from "@/lib/compress-receipt-image";
import { inferReceiptMimeType } from "@/lib/receipt-mime";
import {
  isReceiptFileTooLarge,
  MAX_RECEIPTS,
  receiptPdfSizeError,
  receiptStillTooLargeError,
} from "@/lib/receipt-limits";
import { cn } from "@/lib/utils";

export type ReceiptFileItem = {
  id: string;
  file: File;
  previewUrl: string;
  /** True while a large photo is being shrunk in the background. */
  processing?: boolean;
};

type ReceiptUploadFieldProps = {
  files: ReceiptFileItem[];
  onChange: (files: ReceiptFileItem[]) => void;
  error?: string | null;
};

const fieldShellBase =
  "box-border flex h-field flex-row items-center justify-center gap-2 rounded-xl border-0 bg-white px-3 transition-colors duration-200";

/** Photos only — avoids the extra “camera vs gallery” sheet on many phones. */
const GALLERY_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp";

function ReceiptActionButton(props: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        fieldShellBase,
        "hover:bg-zinc-50 active:bg-zinc-100 focus-visible:outline-none",
      )}
    >
      <span className="inline-flex shrink-0 items-center text-zinc-800">
        {props.children}
      </span>
      <span className="text-sm font-medium leading-none text-zinc-500">
        {props.label}
      </span>
    </button>
  );
}

const receiptIconClass = "size-5 shrink-0";

function ReceiptIconFrame(props: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center"
      aria-hidden
    >
      {props.children}
    </span>
  );
}

function CameraIcon() {
  return (
    <ReceiptIconFrame>
      <svg
        className={receiptIconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 8h2.5l1.6-2.4A1.5 1.5 0 0 1 8.7 5h6.6a1.5 1.5 0 0 1 1.3.75L18 8H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
        />
        <circle cx="12" cy="13" r="3.25" />
      </svg>
    </ReceiptIconFrame>
  );
}

function GalleryIcon() {
  return (
    <ReceiptIconFrame>
      <svg
        className={receiptIconClass}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <rect
          x="2.5"
          y="4"
          width="19"
          height="16"
          rx="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 16.5l3.25-3.25a1 1 0 0 1 1.4 0L17.5 16.5"
        />
        <circle cx="8" cy="9" r="1.35" fill="currentColor" stroke="none" />
      </svg>
    </ReceiptIconFrame>
  );
}

function ReceiptGalleryButton(props: {
  label: string;
  inputId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (files: FileList | null) => void;
}) {
  return (
    <label
      className={cn(
        fieldShellBase,
        "relative cursor-pointer hover:bg-zinc-50 active:bg-zinc-100",
      )}
    >
      <input
        ref={props.inputRef}
        id={props.inputId}
        type="file"
        accept={GALLERY_ACCEPT}
        multiple
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        onChange={(e) => {
          props.onFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />
      <span className="pointer-events-none inline-flex items-center justify-center text-zinc-800">
        <GalleryIcon />
      </span>
      <span className="pointer-events-none text-center text-sm font-medium leading-none text-zinc-500">
        {props.label}
      </span>
    </label>
  );
}

function receiptNeedsCompression(file: File) {
  const mimeType = inferReceiptMimeType(file);
  return mimeType.startsWith("image/") && mimeType !== "image/gif";
}

export function ReceiptUploadField(props: ReceiptUploadFieldProps) {
  const baseId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const filesRef = useRef(props.files);
  filesRef.current = props.files;

  useEffect(() => {
    return () => {
      for (const item of filesRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  function replaceFileItem(id: string, file: File) {
    const latest = filesRef.current;
    props.onChange(
      latest.map((item) => (item.id === id ? { ...item, file, processing: false } : item)),
    );
  }

  function removeFileItem(id: string) {
    const removed = filesRef.current.find((item) => item.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    props.onChange(filesRef.current.filter((item) => item.id !== id));
  }

  function compressInBackground(item: ReceiptFileItem) {
    void compressReceiptFile(item.file).then((compressed) => {
      if (!filesRef.current.some((entry) => entry.id === item.id)) return;
      if (isReceiptFileTooLarge(compressed.size)) {
        removeFileItem(item.id);
        setLocalError(receiptStillTooLargeError());
        return;
      }
      replaceFileItem(item.id, compressed);
    });
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setLocalError(null);

    const incoming = Array.from(fileList);
    const combined = [...props.files.map((item) => item.file), ...incoming];

    if (combined.length > MAX_RECEIPTS) {
      setLocalError(`You can attach up to ${MAX_RECEIPTS} photos.`);
      return;
    }

    const oversizedPdf = incoming.find((file) => {
      const mimeType = inferReceiptMimeType(file);
      return mimeType === "application/pdf" && isReceiptFileTooLarge(file.size);
    });
    if (oversizedPdf) {
      setLocalError(receiptPdfSizeError());
      return;
    }

    const added: ReceiptFileItem[] = incoming.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      processing: receiptNeedsCompression(file),
    }));

    const next = [...props.files, ...added];
    props.onChange(next);

    for (const item of added) {
      if (item.processing) compressInBackground(item);
    }
  }

  function removeFile(id: string) {
    const removed = props.files.find((item) => item.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    props.onChange(props.files.filter((item) => item.id !== id));
  }

  const displayError = props.error ?? localError;
  const galleryInputId = `${baseId}-gallery`;

  return (
    <div className="space-y-3">
      <p className="text-base font-medium text-zinc-500">Receipt Photos</p>

      <div className="flex flex-col">
        <div className="grid grid-cols-2 gap-3">
          <ReceiptActionButton
            label="Take photo"
            onClick={() => cameraRef.current?.click()}
          >
            <CameraIcon />
          </ReceiptActionButton>
          <ReceiptGalleryButton
            label="From gallery"
            inputId={galleryInputId}
            inputRef={galleryRef}
            onFilesSelected={addFiles}
          />
        </div>
        {displayError ? (
          <div className="-mt-px rounded-b-xl bg-rose-50 px-4 py-2.5">
            <p className="text-sm text-rose-800" role="alert">
              {displayError}
            </p>
          </div>
        ) : null}
      </div>

      <input
        ref={cameraRef}
        id={`${baseId}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {props.files.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-600">
            {props.files.length} photo{props.files.length === 1 ? "" : "s"}{" "}
            selected
            {props.files.length < MAX_RECEIPTS
              ? " — tap a button above to add more"
              : ""}
          </p>
          <ul className="grid grid-cols-2 gap-2">
            {props.files.map((item) => (
              <li
                key={item.id}
                className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50"
              >
                {item.file.type.startsWith("image/") && item.previewUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob preview */}
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    {item.processing ? (
                      <span className="absolute inset-x-0 bottom-0 bg-zinc-900/70 px-2 py-1 text-center text-xs font-medium text-white">
                        Optimizing…
                      </span>
                    ) : null}
                  </>
                ) : (
                  <div className="flex aspect-[4/3] flex-col items-center justify-center gap-1 px-2 text-center">
                    <span className="text-2xl" aria-hidden>
                      📄
                    </span>
                    <span className="line-clamp-2 text-xs font-medium text-zinc-700">
                      {item.file.name}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(item.id)}
                  className={cn(
                    "absolute top-1.5 right-1.5 rounded-full bg-zinc-900/75 px-2 py-0.5 text-xs font-medium text-white",
                  )}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
