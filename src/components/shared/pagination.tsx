"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

/**
 * Prev/Next + First/Last + a "jump to page" input. The jump input matters
 * once a dataset is large enough that clicking Next repeatedly isn't a real
 * way to browse it (e.g. the 6-7k-row imported Customers list at 50/page is
 * 130+ pages) — First/Last/jump make the whole dataset actually reachable.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}) {
  const [jumpValue, setJumpValue] = useState("");

  if (totalPages <= 1) return null;

  const start = totalItems && pageSize ? (page - 1) * pageSize + 1 : null;
  const end = totalItems && pageSize ? Math.min(page * pageSize, totalItems) : null;

  function jumpToPage() {
    const n = Number(jumpValue);
    if (Number.isInteger(n) && n >= 1 && n <= totalPages) onPageChange(n);
    setJumpValue("");
  }

  return (
    <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        {start && end ? (
          <>
            Showing <span className="font-medium text-foreground">{start}-{end}</span> of{" "}
            <span className="font-medium text-foreground">{totalItems}</span>
          </>
        ) : (
          <>
            Page {page} of {totalPages}
          </>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(1)} title="First page">
          <ChevronsLeft />
        </Button>
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)} title="Previous page">
          <ChevronLeft />
        </Button>
        <span className="px-2 text-xs font-medium text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} title="Next page">
          <ChevronRight />
        </Button>
        <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} title="Last page">
          <ChevronsRight />
        </Button>
        {totalPages > 5 && (
          <div className="ml-1 flex items-center gap-1">
            <Input
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && jumpToPage()}
              placeholder="Go to"
              className="h-8 w-16 text-xs"
            />
            <Button variant="outline" size="sm" className="h-8" onClick={jumpToPage}>
              Go
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
