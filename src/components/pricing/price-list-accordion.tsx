"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsappShareUrl, type ShareGroup } from "@/lib/price-share";
import { cn } from "@/lib/utils";

/**
 * Compact price list: one accordion row per category (item count), items in tight rows with festival
 * prices inline, and a one-tap WhatsApp share per service or per category. The share opens the user's own
 * WhatsApp with the text filled in (nothing is sent automatically) — pick the customer there.
 * Painting rates are withheld from the share text, same as the public site.
 */
export function PriceListAccordion({ groups }: { groups: ShareGroup[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const allOpen = open.size === groups.length;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.key)))}>
          {allOpen ? "Collapse all" : "Expand all"}
        </Button>
      </div>
      {groups.map((g) => {
        const isOpen = open.has(g.key);
        return (
          <div key={g.key} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 pr-2">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={isOpen}
                aria-controls={`price-${g.key}`}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
              >
                <ChevronDown className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{g.items.length}</span>
              </button>
              <a
                href={whatsappShareUrl(g.shareAll)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-success/10 px-2.5 text-xs font-semibold text-success"
                aria-label={`Share ${g.label} on WhatsApp`}
              >
                <MessageCircle className="size-4" /> <span className="hidden sm:inline">Share all</span>
              </a>
            </div>
            {isOpen && (
              <ul id={`price-${g.key}`} className="divide-y border-t">
                {g.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{i.priceText}</span>
                        {i.mrpText && <span className="ml-1.5 line-through">{i.mrpText}</span>}
                        {i.festival.map((f) => (
                          <span key={f.name} className="ml-1.5 font-semibold text-amber-800">
                            {f.name}: {f.text}
                          </span>
                        ))}
                        {i.detail && <span className="ml-1.5">· {i.detail}</span>}
                      </p>
                    </div>
                    <a
                      href={whatsappShareUrl(i.share)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"
                      aria-label={`Share ${i.name} on WhatsApp`}
                    >
                      <MessageCircle className="size-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
