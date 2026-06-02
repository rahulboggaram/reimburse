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
        "date-input flex h-11 w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3.5 text-base outline-none ring-zinc-900 focus-visible:ring-2",
        className,
      )}
    />
  );
}
