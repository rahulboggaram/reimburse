"use client";

import { useId, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { MAX_RECEIPTS } from "@/lib/receipt-limits";
import { cn } from "@/lib/utils";

export type ReceiptFileItem = {
  id: string;
  file: File;
  previewUrl: string;
};

type ReceiptUploadFieldProps = {
  files: ReceiptFileItem[];
  onChange: (files: ReceiptFileItem[]) => void;
  error?: string | null;
};

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
        "flex h-auto min-h-field flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-zinc-300 bg-white px-3 py-4 transition-colors",
        "hover:border-zinc-400 hover:bg-zinc-50 active:bg-zinc-100",
      )}
    >
      <span
        className="inline-flex size-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800"
        aria-hidden
      >
        {props.children}
      </span>
      <span className="text-sm font-semibold text-zinc-900">{props.label}</span>
    </button>
  );
}

function CameraIcon() {
  return (
    <svg
      className="size-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8h2.5l1.6-2.4A1.5 1.5 0 0 1 8.7 5h6.6a1.5 1.5 0 0 1 1.3.75L18 8H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
      />
      <circle cx="12" cy="13" r="3.25" strokeWidth="2.25" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg
      className="size-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      aria-hidden
    >
      <rect
        x="4"
        y="5"
        width="14"
        height="12"
        rx="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 14l2.5-2.5a1 1 0 0 1 1.4 0L15 14"
      />
      <circle cx="9" cy="9.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ReceiptUploadField(props: ReceiptUploadFieldProps) {
  const baseId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setLocalError(null);

    const incoming = Array.from(fileList);
    const combined = [...props.files.map((item) => item.file), ...incoming];

    if (combined.length > MAX_RECEIPTS) {
      setLocalError(`You can attach up to ${MAX_RECEIPTS} photos.`);
      return;
    }

    const next: ReceiptFileItem[] = [
      ...props.files,
      ...incoming.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : "",
      })),
    ];
    props.onChange(next);
  }

  function removeFile(id: string) {
    const removed = props.files.find((item) => item.id === id);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    props.onChange(props.files.filter((item) => item.id !== id));
  }

  const displayError = props.error ?? localError;

  return (
    <div className="space-y-3">
      <Label>Receipt Photos</Label>

      <div className="grid grid-cols-2 gap-3">
        <ReceiptActionButton
          label="Take photo"
          onClick={() => cameraRef.current?.click()}
        >
          <CameraIcon />
        </ReceiptActionButton>
        <ReceiptActionButton
          label="From gallery"
          onClick={() => galleryRef.current?.click()}
        >
          <GalleryIcon />
        </ReceiptActionButton>
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
      <input
        ref={galleryRef}
        id={`${baseId}-gallery`}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {displayError ? (
        <p className="text-sm text-red-700" role="alert">
          {displayError}
        </p>
      ) : null}

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
                  // eslint-disable-next-line @next/next/no-img-element -- blob preview
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="aspect-[4/3] w-full object-cover"
                  />
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
