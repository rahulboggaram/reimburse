"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { fieldOutlineColors, Select } from "@/components/ui/select";

type FieldVisualState = "idle" | "focused" | "filled";

const errorAccentText = "text-rose-800";
const errorBannerBg = "bg-rose-50";

function getFieldState(focused: boolean, hasValue: boolean): FieldVisualState {
  if (focused) return "focused";
  if (hasValue) return "filled";
  return "idle";
}

/* Classic (cream + blue): use border-[1.5px], border-zinc-300 idle, border-accent focused. */

function normalShellClass(_state: FieldVisualState) {
  return "relative rounded-xl border-0 bg-white transition-colors duration-200";
}

const errorFieldShell = "relative rounded-xl border-0 bg-white transition-colors duration-200";

function labelClass(
  state: FieldVisualState,
  floated: boolean,
  error?: boolean,
) {
  return cn(
    "pointer-events-none absolute left-4 z-10 max-w-[calc(100%-2rem)] truncate leading-none transition-all duration-200 ease-out",
    floated
      ? "top-2.5 translate-y-0 bg-transparent px-0 text-xs font-medium"
      : "top-1/2 -translate-y-1/2 bg-transparent px-0 text-base font-medium",
    error && errorAccentText,
    !error && !floated && "text-zinc-500",
    !error && floated && state === "focused" && "text-accent",
    !error && floated && state === "filled" && "text-zinc-500",
  );
}

function valueClassForState(state: FieldVisualState) {
  return cn(
    "leading-normal text-zinc-900",
    state === "filled" ? "text-lg font-semibold" : "text-base font-medium",
  );
}

const controlClass =
  "w-full min-w-0 border-0 bg-transparent p-0 outline-none";

function FieldControl(props: {
  floated?: boolean;
  multiline?: boolean;
  autoGrow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex w-full px-4",
        props.multiline &&
          (props.autoGrow
            ? cn(
                "min-h-field",
                props.floated ? "items-start gap-2 pb-3 pt-6" : "items-center",
              )
            : "min-h-textarea items-center py-3"),
        !props.multiline &&
          (props.floated
            ? "h-field items-start pb-3 pt-6"
            : "h-field items-center"),
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
  errorMessage?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const displayFloated = props.floated || Boolean(props.error);

  const labelNode = (
    <label
      htmlFor={props.id}
      className={labelClass(props.state, displayFloated, props.error)}
    >
      {props.label}
      {props.required ? (
        <span className={cn(props.error && errorAccentText)}> *</span>
      ) : null}
    </label>
  );

  if (props.error) {
    const hasMessage = Boolean(props.errorMessage);

    if (hasMessage) {
      return (
        <div className="overflow-hidden rounded-xl">
          <div className="relative bg-white">
            {labelNode}
            {props.children}
          </div>
          <div className={cn(errorBannerBg, "px-4 py-2.5")}>
            <p className={cn("text-sm", errorAccentText)} role="alert">
              {props.errorMessage}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={errorFieldShell}>
        {labelNode}
        {props.children}
      </div>
    );
  }

  return (
    <div className={normalShellClass(props.state)}>
      {labelNode}
      {props.children}
    </div>
  );
}

export function FieldError(props: { message?: string }) {
  if (!props.message) return null;
  return (
    <p className={cn("text-sm", errorAccentText)} role="alert">
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
    required,
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
      errorMessage={fieldError}
      required={required}
    >
      <FieldControl floated={floated}>
        <input
          {...inputProps}
          id={id}
          required={required}
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
            showValue ? valueClassForState(state) : "text-transparent caret-zinc-900",
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
  const {
    label,
    error,
    fieldError,
    className,
    id: idProp,
    value,
    required,
    ...selectProps
  } = props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const { setFocused, floated, state } = useFloatingFieldState(value);
  const showValue = state === "focused" || state === "filled";
  const outlineColor = error
    ? fieldOutlineColors.error
    : state === "focused"
      ? fieldOutlineColors.focused
      : fieldOutlineColors.idle;

  return (
    <FieldWrap
      id={id}
      label={label}
      state={state}
      floated={floated}
      error={error}
      errorMessage={fieldError}
      required={required}
    >
      <FieldControl floated={floated}>
        <Select
          {...selectProps}
          outlineColor={outlineColor}
          id={id}
          required={required}
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
            showValue ? valueClassForState(state) : "text-transparent",
            className,
          )}
        >
          {props.children}
        </Select>
      </FieldControl>
    </FieldWrap>
  );
}

function resizeTextarea(el: HTMLTextAreaElement) {
  const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 24;
  el.style.height = "0px";
  el.style.height = `${Math.max(el.scrollHeight, lineHeight)}px`;
}

export function FloatingTextarea(
  props: React.ComponentProps<"textarea"> & {
    label: string;
    error?: boolean;
    fieldError?: string;
    autoResize?: boolean;
    rows?: number;
  },
) {
  const {
    label,
    error,
    fieldError,
    className,
    id: idProp,
    value,
    autoResize = true,
    rows = 1,
    required,
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
    resizeTextarea(ref.current);
  }, [value, autoResize, floated]);

  return (
    <FieldWrap
      id={id}
      label={label}
      state={state}
      floated={floated}
      error={error}
      errorMessage={fieldError}
      required={required}
    >
      <FieldControl floated={floated} multiline autoGrow={autoResize}>
        <textarea
          {...textareaProps}
          ref={ref}
          id={id}
          rows={rows}
          required={required}
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
            if (autoResize) resizeTextarea(e.currentTarget);
            onChange?.(e);
          }}
          className={cn(
            controlClass,
            "resize-none leading-relaxed",
            autoResize && "min-h-0 overflow-hidden",
            showValue ? valueClassForState(state) : "text-transparent caret-zinc-900",
            className,
          )}
        />
      </FieldControl>
    </FieldWrap>
  );
}
