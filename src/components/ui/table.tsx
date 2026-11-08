"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps every table in the app with a synchronized top+bottom horizontal
 * scrollbar (owner instruction 2026-09-21: wide tables — Leads/Jobs/Staff/
 * Payments/Customers — only had a scrollbar at the very bottom, easy to
 * miss, especially once the table itself is tall). The top strip is a
 * thin, empty scroll track sized to match the table's real scrollWidth;
 * scrolling either one moves the other via scrollLeft, guarded by a ref so
 * the two onScroll handlers don't ping-pong each other.
 */
function Table({ className, children, fit, ...props }: React.ComponentProps<"table"> & { fit?: boolean }) {
  const topRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [scrollWidth, setScrollWidth] = React.useState(0);
  const syncingFrom = React.useRef<"top" | "bottom" | null>(null);

  React.useEffect(() => {
    const el = tableRef.current;
    if (!el) return;
    const update = () => setScrollWidth(el.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  function onTopScroll() {
    if (syncingFrom.current === "bottom") {
      syncingFrom.current = null;
      return;
    }
    syncingFrom.current = "top";
    if (bottomRef.current && topRef.current) bottomRef.current.scrollLeft = topRef.current.scrollLeft;
  }

  function onBottomScroll() {
    if (syncingFrom.current === "top") {
      syncingFrom.current = null;
      return;
    }
    syncingFrom.current = "bottom";
    if (bottomRef.current && topRef.current) topRef.current.scrollLeft = bottomRef.current.scrollLeft;
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border">
      {scrollWidth > 0 && (
        <div ref={topRef} onScroll={onTopScroll} className={cn("hidden overflow-x-auto overflow-y-hidden sm:block", fit && "lg:hidden")} style={{ height: 10 }}>
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
      )}
      <div ref={bottomRef} onScroll={onBottomScroll} className={cn("relative w-full overflow-x-auto", fit && "lg:overflow-x-hidden")}>
        <table ref={tableRef} className={cn(
            "w-full caption-bottom text-[13px]",
            fit && "lg:table-fixed lg:[&_td]:overflow-hidden lg:[&_td]:text-ellipsis lg:[&_th]:overflow-hidden lg:[&_th]:text-ellipsis",
            className
          )} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-muted/60 [&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return <tfoot className={cn("bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-border transition-colors hover:bg-muted/40 data-[state=selected]:bg-muted", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-9 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-2 py-2 align-middle whitespace-nowrap", className)} {...props} />;
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
