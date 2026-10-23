"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A collapsed-by-default section of the customer quotation (Scope of Work, Equipment, Terms). It opens by itself while the page is being
 * printed / saved as PDF, so the printed quotation always carries everything.
 */
export function DocAccordion({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let was = false;
    const before = () => {
      was = !!ref.current?.open;
      if (ref.current) ref.current.open = true;
    };
    const after = () => {
      if (ref.current) ref.current.open = was;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  return (
    <details ref={ref} className="group min-w-0 rounded-xl border border-[#0a2540]/15 bg-white print:border-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-primary print:min-h-0 print:px-0 print:py-0">
        {title}
        <ChevronDown className="size-4 transition-transform group-open:rotate-180 print:hidden" />
      </summary>
      <div className="px-3 pb-3 print:px-0 print:pb-0">{children}</div>
    </details>
  );
}
