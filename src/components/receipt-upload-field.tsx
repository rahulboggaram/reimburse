"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

function ReceiptActionIcon(props: { children: React.ReactNode }) {
  return (
    <span className="inline-flex size-5 shrink-0 text-zinc-500" aria-hidden>
      {props.children}
    </span>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.827 6.175A2.31 2.31 0 0 1 8.955 5h6.09a2.31 2.31 0 0 1 2.128 1.175l1.27 2.54A2.31 2.31 0 0 0 20.59 9H22a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1.41a2.31 2.31 0 0 0 2.123-1.285l1.27-2.54Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6.75a1.5 1.5 0 0 0-1.5-1.5H3.75a1.5 1.5 0 0 0-1.5 1.5v11.25a1.5 1.5 0 0 0 1.5 1.5Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 7.5h.008v.008H16.5V7.5Z"
      />
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
      <div className="space-y-0.5">
        <Label>Receipt Photos</Label>
        <p className="text-xs text-zinc-500">Add one or more photos</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-field gap-2 px-2 text-xs font-medium sm:px-4 sm:text-sm"
          onClick={() => cameraRef.current?.click()}
        >
          <ReceiptActionIcon>
            <CameraIcon />
          </ReceiptActionIcon>
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-field gap-2 px-2 text-xs font-medium sm:px-4 sm:text-sm"
          onClick={() => galleryRef.current?.click()}
        >
          <ReceiptActionIcon>
            <GalleryIcon />
          </ReceiptActionIcon>
          From gallery
        </Button>
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
