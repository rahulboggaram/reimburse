"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const textareaClassName =
  "flex min-h-textarea w-full rounded-xl border-0 bg-white px-4 py-3 text-base leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15";

function resizeToContent(textarea: HTMLTextAreaElement) {
  textarea.style.height = "0px";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function Textarea(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(textareaClassName, props.className)} />;
}

export function AutoResizeTextarea(props: React.ComponentProps<"textarea">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { onChange, value, className, rows = 3, ...rest } = props;

  useLayoutEffect(() => {
    if (ref.current) resizeToContent(ref.current);
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      rows={rows}
      onChange={(event) => {
        resizeToContent(event.currentTarget);
        onChange?.(event);
      }}
      className={cn(
        textareaClassName,
        "resize-none overflow-hidden",
        className,
      )}
    />
  );
}
