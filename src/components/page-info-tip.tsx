"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="size-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Info icon beside a page title — tap or hover to read helper text. */
export function PageInfoTip(props: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex shrink-0", props.className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={tipId}
        aria-label="Show information"
        className="inline-flex size-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
        onClick={() => setOpen((value) => !value)}
      >
        <InfoIcon />
      </button>
      {open ? (
        <div
          id={tipId}
          role="tooltip"
          className="absolute top-full left-0 z-20 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-zinc-600 shadow-md"
        >
          {props.text}
        </div>
      ) : null}
    </div>
  );
}
