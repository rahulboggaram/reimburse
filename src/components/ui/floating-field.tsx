"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";

type FieldVisualState = "idle" | "focused" | "filled";

function getFieldState(focused: boolean, hasValue: boolean): FieldVisualState {
  if (focused) return "focused";
  if (hasValue) return "filled";
  return "idle";
}

function shellClass(state: FieldVisualState, error?: boolean) {
  if (error) {
    return "relative rounded-xl border-2 border-red-300 bg-white shadow-sm shadow-zinc-200/30 transition-[border-color,box-shadow] focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-200/60";
  }
  return cn(
    "relative rounded-xl border-2 bg-white shadow-sm shadow-zinc-200/30 transition-[border-color,box-shadow] duration-200",
    state === "focused" &&
      "border-2 border-blue-600 ring-2 ring-blue-600/20 ring-offset-2 ring-offset-white",
    (state === "idle" || state === "filled") && "border-zinc-300",
  );
}

function labelClass(state: FieldVisualState, floated: boolean) {
  return cn(
    "pointer-events-none absolute left-4 z-10 max-w-[calc(100%-2rem)] truncate bg-white px-0.5 leading-none transition-all duration-200 ease-out",
    floated
      ? "top-0 -translate-y-1/2 text-xs font-medium"
      : "top-1/2 -translate-y-1/2 text-base font-medium text-zinc-500",
    floated && state === "focused" && "text-blue-600",
    floated && state === "filled" && "text-zinc-500",
  );
}

function valueClassForState(state: FieldVisualState) {
  return cn(
    "text-base leading-normal text-zinc-900",
    state === "filled" ? "font-semibold" : "font-medium",
  );
}

const controlClass =
  "w-full min-w-0 border-0 bg-transparent p-0 outline-none";

function FieldControl(props: {
  multiline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full px-4",
        props.multiline
          ? "min-h-textarea items-center py-3"
          : "h-field items-center",
      )}
    >
      {props.children}
    </div>
  );
}

function FieldWrap(props: {
  id: string;
  label: string;
  state: FieldVisualState;
  floated: boolean;
  error?: boolean;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className={shellClass(props.state, props.error)}>
        <label htmlFor={props.id} className={labelClass(props.state, props.floated)}>
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

function useFloatingFieldState(value: unknown) {
  const [focused, setFocused] = useState(false);
  const hasValue =
    value !== undefined && value !== null && String(value).length > 0;
  const floated = focused || hasValue;
  const state = getFieldState(focused, hasValue);
  return { focused, setFocused, hasValue, floated, state };
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
    value,
    onFocus,
    onBlur,
    ...inputProps
  } = props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const { setFocused, floated, state } = useFloatingFieldState(value);
  const showValue = state === "focused" || state === "filled";

  return (
    <FieldWrap
      id={id}
      label={label}
      state={state}
      floated={floated}
      error={error}
      hint={<FieldError message={fieldError} />}
    >
      <FieldControl>
        <input
          {...inputProps}
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
          className={cn(
            controlClass,
            showValue ? valueClass : "text-transparent caret-zinc-900",
            className,
          )}
        />
      </FieldControl>
    </FieldWrap>
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
  const { setFocused, floated, state } = useFloatingFieldState(value);
  const showValue = state === "focused" || state === "filled";

  return (
    <FieldWrap
      id={id}
      label={label}
      state={state}
      floated={floated}
      error={error}
      hint={<FieldError message={fieldError} />}
    >
      <FieldControl>
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
            "h-full min-h-0 w-full rounded-none border-0 bg-transparent py-0 pl-0 pr-8 shadow-none ring-0 focus-visible:ring-0",
            showValue ? valueClass : "text-transparent",
            className,
          )}
        >
          {props.children}
        </Select>
      </FieldControl>
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
  const { setFocused, floated, state } = useFloatingFieldState(value);
  const showValue = state === "focused" || state === "filled";

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
      state={state}
      floated={floated}
      error={error}
      hint={<FieldError message={fieldError} />}
    >
      <FieldControl multiline>
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
            controlClass,
            "min-h-[1.5rem] resize-none leading-relaxed",
            showValue ? valueClass : "text-transparent caret-zinc-900",
            className,
          )}
        />
      </FieldControl>
    </FieldWrap>
  );
}
