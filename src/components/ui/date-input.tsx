"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export function DateInput({
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const ref = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = ref.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  return (
    <input
      {...props}
      ref={ref}
      type="date"
      onClick={(event) => {
        onClick?.(event);
        openPicker();
      }}
      className={cn(
        "date-input flex h-field w-full cursor-pointer rounded-xl border-0 bg-white px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15",
        className,
      )}
    />
  );
}
