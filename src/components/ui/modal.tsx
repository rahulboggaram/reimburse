"use client";

import { useEffect } from "react";
import { toTitleCase } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export function Modal(props: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!props.open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  const hasHeader = Boolean(props.title || props.subtitle);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={props.onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={props.title ? "modal-title" : undefined}
        aria-label={props.title ? undefined : "Details"}
        className={cn(
          "relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl",
          props.className,
        )}
      >
        <div className="overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            {hasHeader ? (
              <div className="min-w-0 flex-1">
                {props.title ? (
                  <h2
                    id="modal-title"
                    className="text-lg font-semibold text-zinc-900"
                  >
                    {toTitleCase(props.title)}
                  </h2>
                ) : null}
                {props.subtitle ? (
                  <p
                    className={cn(
                      "text-sm text-zinc-500",
                      props.title ? "mt-1" : undefined,
                    )}
                  >
                    {props.subtitle}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            <button
              type="button"
              onClick={props.onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-1.5 shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className={cn(hasHeader ? "mt-4" : "mt-3")}>{props.children}</div>
        </div>
      </div>
    </div>
  );
}
