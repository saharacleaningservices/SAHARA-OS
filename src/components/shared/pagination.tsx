"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  if (totalPages <= 1) return null;

  const start = totalItems && pageSize ? (page - 1) * pageSize + 1 : null;
  const end = totalItems && pageSize ? Math.min(page * pageSize, totalItems) : null;

  return (
    <div className="flex items-center justify-between gap-3 pt-1">
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
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="px-2 text-xs font-medium text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
