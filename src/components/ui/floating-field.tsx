"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

const shellClass =
  "relative rounded-xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-200/30 transition-[border-color,box-shadow] focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-800/20";

function floatingLabel(active: boolean) {
  return cn(
    "pointer-events-none absolute left-4 z-10 max-w-[calc(100%-2rem)] truncate bg-white px-0.5 leading-none transition-all duration-200 ease-out",
    active
      ? "top-0 -translate-y-1/2 text-xs font-medium text-emerald-800"
      : "top-1/2 -translate-y-1/2 text-base font-normal text-zinc-500",
  );
}

const inputClass =
  "peer block h-field w-full rounded-xl border-0 bg-transparent px-4 pb-2.5 pt-5 text-base text-zinc-900 outline-none placeholder:text-transparent";

function FieldWrap(props: {
  id: string;
  label: string;
  active: boolean;
  error?: boolean;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div
        className={cn(
          shellClass,
          props.error &&
            "border-red-300 focus-within:border-red-400 focus-within:ring-red-200/60",
        )}
      >
        <label htmlFor={props.id} className={floatingLabel(props.active)}>
          {props.label}
        </label>
        {props.children}
      </div>
      {props.hint}
    </div>
  );
}

export function FieldError(props: { message?: string }) {
  if (!props.message) return null;
  return (
    <p className="text-sm text-red-700" role="alert">
      {props.message}
    </p>
  );
}

export function FloatingInput(
  props: React.ComponentProps<"input"> & {
    label: string;
    error?: boolean;
    fieldError?: string;
  },
) {
  const {
    label,
    error,
    fieldError,
    className,
    id: idProp,
    type,
    value,
    onFocus,
    onBlur,
    ...inputProps
  } = props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const [focused, setFocused] = useState(false);
  const useStateLabel = type === "date" || type === "time";
  const hasValue =
    value !== undefined && value !== null && String(value).length > 0;
  const active = useStateLabel ? focused || hasValue : false;

  if (useStateLabel) {
    return (
      <FieldWrap
        id={id}
        label={label}
        active={active}
        error={error}
        hint={<FieldError message={fieldError} />}
      >
        <input
          {...inputProps}
          type={type}
          id={id}
          value={value}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={cn(inputClass, className)}
        />
      </FieldWrap>
    );
  }

  return (
    <div className="space-y-1">
      <div
        className={cn(
          shellClass,
          error &&
            "border-red-300 focus-within:border-red-400 focus-within:ring-red-200/60",
        )}
      >
        <input
          {...inputProps}
          type={type}
          id={id}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder=" "
          className={cn(inputClass, "peer", className)}
        />
        <label
          htmlFor={id}
          className={cn(
            floatingLabel(false),
            "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-xs peer-focus:font-medium peer-focus:text-emerald-800",
            "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:text-emerald-800",
          )}
        >
          {label}
        </label>
      </div>
      <FieldError message={fieldError} />
    </div>
  );
}

export function FloatingSelect(
  props: React.ComponentProps<"select"> & {
    label: string;
    error?: boolean;
    fieldError?: string;
    children: React.ReactNode;
  },
) {
  const { label, error, fieldError, className, id: idProp, value, ...selectProps } =
    props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const [focused, setFocused] = useState(false);
  const hasValue =
    value !== undefined && value !== null && String(value).length > 0;
  const active = focused || hasValue;

  return (
    <FieldWrap
      id={id}
      label={label}
      active={active}
      error={error}
      hint={<FieldError message={fieldError} />}
    >
      <Select
        {...selectProps}
        id={id}
        value={value}
        onFocus={(e) => {
          setFocused(true);
          selectProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          selectProps.onBlur?.(e);
        }}
        className={cn(
          "h-field w-full rounded-xl border-0 bg-transparent py-0 pl-4 pr-12 shadow-none ring-0 focus-visible:ring-0",
          active ? "pt-5 pb-2.5 text-zinc-900" : "text-transparent",
          className,
        )}
      >
        {props.children}
      </Select>
    </FieldWrap>
  );
}

export function FloatingTextarea(
  props: React.ComponentProps<"textarea"> & {
    label: string;
    error?: boolean;
    fieldError?: string;
    autoResize?: boolean;
  },
) {
  const {
    label,
    error,
    fieldError,
    className,
    id: idProp,
    value,
    autoResize,
    onChange,
    ...textareaProps
  } = props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const hasValue =
    value !== undefined && value !== null && String(value).length > 0;
  const active = focused || hasValue;

  useLayoutEffect(() => {
    if (!autoResize || !ref.current) return;
    const el = ref.current;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, autoResize]);

  return (
    <FieldWrap
      id={id}
      label={label}
      active={active}
      error={error}
      hint={<FieldError message={fieldError} />}
    >
      <textarea
        {...textareaProps}
        ref={ref}
        id={id}
        value={value}
        onFocus={(e) => {
          setFocused(true);
          textareaProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          textareaProps.onBlur?.(e);
        }}
        onChange={(e) => {
          if (autoResize) {
            e.currentTarget.style.height = "0px";
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
          }
          onChange?.(e);
        }}
        className={cn(
          "block min-h-textarea w-full resize-none rounded-xl border-0 bg-transparent px-4 text-base leading-relaxed outline-none",
          active
            ? "pt-6 pb-3 text-zinc-900"
            : "pt-5 pb-3 text-transparent caret-zinc-900 focus:text-zinc-900",
          className,
        )}
      />
    </FieldWrap>
  );
}
