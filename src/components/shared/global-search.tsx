"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Loader2, Users, ClipboardList, UserCog, IndianRupee, Truck } from "lucide-react";
import { runGlobalSearch } from "@/server/actions/search";
import type { SearchResult } from "@/server/search";
import { cn } from "@/lib/utils";

const ICONS: Record<SearchResult["type"], React.ComponentType<{ className?: string }>> = {
  Lead: Users,
  Job: ClipboardList,
  Staff: UserCog,
  Payment: IndianRupee,
  Vehicle: Truck,
  Customer: Users,
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    // Performance audit (Phase 9, 2026-09-21): this previously fired a
    // server round-trip on every single keystroke with no debounce —
    // typing a full name/mobile number meant a dozen-plus overlapping
    // queries, each racing the others for which response landed last.
    // 250ms keeps the perceived result well under the "search under
    // 500ms" target while cutting server load roughly in proportion to
    // typing speed.
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await runGlobalSearch(value);
        setResults("results" in res ? res.results : []);
      });
    }, 250);
  }

  return (
    <div ref={boxRef} className="relative hidden w-full max-w-xs sm:block">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search customers, jobs, staff, invoices…"
        className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {pending ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No matches for "{query}"</p>
          ) : (
            <ul className="py-1">
              {results.map((r) => {
                const Icon = ICONS[r.type];
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <Link
                      href={r.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent"
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{r.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.type} · {r.subtitle}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
