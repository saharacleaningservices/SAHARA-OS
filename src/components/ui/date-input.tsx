"use client";

import { forwardRef, useRef } from "react";
import { Input } from "@/components/ui/input";

/**
 * `<input type="date">` (or time / datetime-local) that reliably opens its
 * picker. On several browsers / Android the native picker won't open from a
 * tap on the field or its label — this calls `showPicker()` on click/focus
 * (guarded). The browser's own calendar indicator still works too.
 */
export type DateInputProps = React.ComponentPropsWithoutRef<typeof Input> & {
  type?: "date" | "time" | "datetime-local" | "month";
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { type = "date", onClick, onFocus, ...props },
  forwardedRef,
) {
  const localRef = useRef<HTMLInputElement | null>(null);

  function setRef(el: HTMLInputElement | null) {
    localRef.current = el;
    if (typeof forwardedRef === "function") forwardedRef(el);
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
  }

  function open() {
    const el = localRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (el && typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        /* not user-activated / unsupported — the native indicator still works */
      }
    }
  }

  return (
    <Input
      ref={setRef}
      type={type}
      onClick={(e) => {
        onClick?.(e);
        open();
      }}
      onFocus={(e) => {
        onFocus?.(e);
        open();
      }}
      {...props}
    />
  );
});
