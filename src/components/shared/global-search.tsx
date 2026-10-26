"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { Search, Loader2, Users, ClipboardList, UserCog, IndianRupee, Truck, History, MapPin, X, ArrowRight } from "lucide-react";
import { runGlobalSearch } from "@/server/actions/search";
import type { SearchResult } from "@/server/search";
import type { QuickHistory } from "@/server/customer-quick-history";
import { cn, formatDate, formatINR } from "@/lib/utils";

const ICONS: Record<SearchResult["type"], React.ComponentType<{ className?: string }>> = {
  Lead: Users,
  Job: ClipboardList,
  Staff: UserCog,
  Payment: IndianRupee,
  Vehicle: Truck,
  Customer: Users,
};

type HistoryState = { mobile: string; status: "loading" | "ready" | "none" | "error"; data?: QuickHistory };

/**
 * "Past History / Read More" card (owner 2026-10-25). Layout model: BOX MODEL — one fixed card (name, address,
 * last 3 services, total billed) so the figures sit in the same place for every customer; it opens instantly
 * for the first matching customer and for any row's History button.
 */
function HistoryCard({ h, onClose, onOpen }: { h: HistoryState; onClose: () => void; onOpen: () => void }) {
  return (
    <div className="m-2 rounded-xl border border-amber-300/70 bg-amber-50/60 p-3 text-sm shadow-sm dark:border-amber-800 dark:bg-amber-950/20" role="region" aria-label="Customer past history">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          <History className="size-3.5" /> Past history
        </p>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:bg-accent" aria-label="Close past history">
          <X className="size-3.5" />
        </button>
      </div>
      {h.status === "loading" ? (
        <p className="flex items-center gap-2 py-3 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Loading history…</p>
      ) : h.status !== "ready" || !h.data ? (
        <p className="py-2 text-muted-foreground">{h.status === "none" ? "No past services or bills for this number yet." : "History is not available right now."}</p>
      ) : (
        <>
          <p className="mt-1 truncate font-semibold text-foreground">
            {h.data.name}
            {h.data.customerNumber ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{h.data.customerNumber}</span> : null}
          </p>
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3 shrink-0" />
            <span className="line-clamp-2">{h.data.address || "Address not recorded"}</span>
          </p>
          <ul className="mt-2 divide-y divide-border/70 rounded-lg border border-border/70 bg-card">
            {h.data.lastServices.length === 0 ? (
              <li className="px-2.5 py-2 text-xs text-muted-foreground">No completed services yet.</li>
            ) : (
              h.data.lastServices.map((s, i) => (
                <li key={`${s.ref}-${i}`} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">{formatDate(s.date)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.service}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">{formatINR(s.amount)}</span>
                </li>
              ))
            )}
          </ul>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-card px-2.5 py-1.5">
              <p className="text-[11px] text-muted-foreground">Total billed · {h.data.billCount} bill{h.data.billCount === 1 ? "" : "s"}</p>
              <p className="font-bold tabular-nums">{formatINR(h.data.totalBilled)}</p>
            </div>
            <div className="rounded-lg bg-card px-2.5 py-1.5">
              <p className="text-[11px] text-muted-foreground">Outstanding</p>
              <p className={cn("font-bold tabular-nums", h.data.outstanding > 0 && "text-amber-700 dark:text-amber-400")}>{formatINR(h.data.outstanding)}</p>
            </div>
          </div>
          <Link href={`/customers/${h.data.mobile}`} onClick={onOpen} className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            Read more — full history <ArrowRight className="size-3.5" />
          </Link>
        </>
      )}
    </div>
  );
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [pending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const historyReq = useRef(0);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadHistory(mobile: string) {
    const req = ++historyReq.current; // only the latest request may update the card
    setHistory({ mobile, status: "loading" });
    try {
      const res = await fetch(`/api/customers/quick-history?mobile=${encodeURIComponent(mobile)}`, { cache: "no-store" });
      if (req !== historyReq.current) return;
      if (res.status === 404) return setHistory({ mobile, status: "none" });
      if (!res.ok) return setHistory({ mobile, status: "error" });
      setHistory({ mobile, status: "ready", data: (await res.json()) as QuickHistory });
    } catch {
      if (req === historyReq.current) setHistory({ mobile, status: "error" });
    }
  }

  function onChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setHistory(null);
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
        const list = "results" in res ? res.results : [];
        setResults(list);
        // Past History opens instantly for the first customer found (name or phone search).
        const first = list.find((r) => r.mobile)?.mobile;
        if (first) void loadHistory(first);
        else setHistory(null);
      });
    }, 250);
  }

  const close = () => setOpen(false);

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search name, mobile, job, invoice…"
        aria-label="Search customers, jobs, staff and invoices"
        className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && query.trim().length >= 2 && (
        // Phones: a full-width panel under the top bar; sm and up: a dropdown under the box.
        <div className="fixed inset-x-3 top-16 z-50 max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-popover shadow-lg sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-1 sm:max-h-[32rem] sm:w-[26rem]">
          {history && <HistoryCard h={history} onClose={() => setHistory(null)} onOpen={close} />}
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
                const active = !!r.mobile && history?.mobile === r.mobile;
                return (
                  <li key={`${r.type}-${r.id}`} className="flex items-center gap-1 pr-2 hover:bg-accent">
                    <Link href={r.href} onClick={close} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-sm">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{r.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.type} · {r.subtitle}
                        </span>
                      </span>
                    </Link>
                    {r.mobile ? (
                      <button
                        type="button"
                        onClick={() => void loadHistory(r.mobile as string)}
                        className={cn("flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium", active ? "border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" : "border-border text-muted-foreground hover:text-foreground")}
                        aria-label={`Past history for ${r.title}`}
                      >
                        <History className="size-3" /> History
                      </button>
                    ) : null}
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
