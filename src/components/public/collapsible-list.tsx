"use client";

import { Children, cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";

/**
 * Compact package cards on phones (owner 2026-11-12): only the first `limit` list rows show until the visitor taps
 * "+ Show all inclusions". From the md breakpoint up the full list is always visible and the toggle is hidden.
 */
export function CollapsibleList({ className, children, limit = 5, label = "inclusions" }: { className?: string; children: ReactNode; limit?: number; label?: string }) {
  const [open, setOpen] = useState(false);
  const rows = Children.toArray(children);
  const extra = rows.length - limit;
  return (
    <>
      <ul className={className}>
        {rows.map((row, n) => (!open && n >= limit && isValidElement(row) ? cloneElement(row as ReactElement<{ className?: string }>, { className: `${(row as ReactElement<{ className?: string }>).props.className ?? ""} max-md:hidden` }) : row))}
      </ul>
      {extra > 0 && (
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="mt-1.5 min-h-9 text-xs font-extrabold text-primary md:hidden">
          {open ? "Show less" : `+ Show all ${label} (${extra} more)`}
        </button>
      )}
    </>
  );
}
