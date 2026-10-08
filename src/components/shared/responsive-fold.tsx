"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Secondary section that starts collapsed on phones (keeps pages to 1–2
 * scrolls) and expanded from the sm breakpoint up, so desktop layouts are
 * unchanged. Children mount only while open (charts don't render hidden).
 */
export function ResponsiveFold({ title, hint, children, className }: { title: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) setOpen(true);
  }, []);
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="min-w-0 truncate text-sm font-semibold">
          {title}
          {hint ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-3 pb-3 sm:px-4 sm:pb-4">{children}</div>}
    </section>
  );
}
