"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Click-to-expand card used across the Owner Command Center (hero cards,
 * Revenue Intelligence). No accordion/collapsible primitive exists yet in
 * this shadcn setup, so this is a small local pattern: a CSS grid-rows
 * transition gives a smooth open/close without measuring scrollHeight in JS.
 */
export function ExpandableCard({
  trigger,
  children,
  defaultOpen = false,
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={cn("gap-0 overflow-hidden p-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        {trigger}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 200ms ease",
        }}
      >
        <div className="overflow-hidden">
          <CardContent className="pt-0 pb-4">{children}</CardContent>
        </div>
      </div>
    </Card>
  );
}
