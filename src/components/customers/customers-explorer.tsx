"use client";

import { useState, useTransition } from "react";
import { CustomerHistoryButton } from "@/components/customers/customer-history-drawer";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Loader2, MapPin, MessageCircle, Phone, Search, X } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { WhatsappCampaignDialog } from "@/components/customers/whatsapp-campaign-dialog";
import { ContactTypeBadge, ContactTypeIcon, RepeatBadge } from "@/components/customers/contact-badges";
import { exportCustomerRows } from "@/server/actions/customer-sites";
import { downloadCsv } from "@/lib/csv-export";
import { formatINR, formatDate, toTelLink, toWhatsAppLink } from "@/lib/utils";

export type CustomerListRow = {
  mobile: string;
  name: string;
  leadCount: number;
  jobCount: number;
  revenue: number;
  lastActivity: Date | string;
  area?: string | null;
  outstanding?: number;
  contactType: string;
  customerNumber?: string | null;
  isRepeat: boolean;
  siteCount: number;
  variants: number;
};

const FILTERS: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "CUSTOMER", label: "Direct Customer" },
  { key: "REPEAT", label: "Repeat" },
  { key: "BROKER", label: "Broker" },
  { key: "INTERIOR_DESIGNER", label: "Interior Designer" },
  { key: "VENDOR", label: "Vendor" },
  { key: "AMC_CLIENT", label: "AMC Client" },
  { key: "CORPORATE", label: "Commercial / B2B Partner" },
  { key: "ARCHITECT", label: "Architect (old)" },
  { key: "SOCIETY", label: "Society / Facility (old)" },
  { key: "ACTIVE", label: "Active (6 months)" },
  { key: "INACTIVE", label: "No recent activity" },
  { key: "DUPLICATES", label: "Possible duplicates" },
];

const isPartner = (t: string) => t !== "CUSTOMER";

/**
 * Customers list — search, filter and paging all happen on the server (URL
 * params), so only one page of the 4,000+ contacts ever reaches the browser.
 * Desktop: compact table. Mobile: short cards with Call / WhatsApp / Open.
 */
export function CustomersExplorer({
  rows,
  total,
  counts,
  page,
  totalPages,
  filter,
  q,
  canCampaign,
}: {
  rows: CustomerListRow[];
  total: number;
  counts: Record<string, number>;
  page: number;
  totalPages: number;
  filter: string;
  q: string;
  canCampaign: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigating, startNav] = useTransition();
  const [exporting, startExport] = useTransition();
  const [search, setSearch] = useState(q);
  // Selection survives paging (name kept for the campaign dialog).
  const [selected, setSelected] = useState<Record<string, string>>({});
  const selectedList = Object.entries(selected).map(([mobile, name]) => ({ mobile, name }));

  function go(next: Record<string, string | number | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "" || v === "ALL" || (k === "page" && v === 1)) sp.delete(k);
      else sp.set(k, String(v));
    }
    startNav(() => router.push(`${pathname}${sp.size ? `?${sp}` : ""}`));
  }
  function toggle(c: CustomerListRow, on: boolean) {
    setSelected((s) => {
      const n = { ...s };
      if (on) n[c.mobile] = c.name;
      else delete n[c.mobile];
      return n;
    });
  }
  function exportCsv(onlySelected: boolean) {
    startExport(async () => {
      const all = await exportCustomerRows({ q, filter });
      if (!all) return;
      const rowsOut = onlySelected ? all.filter((r) => selected[r.Mobile]) : all;
      downloadCsv(`sahara-os-customers-${onlySelected ? "selected-" : ""}${new Date().toISOString().slice(0, 10)}.csv`, rowsOut);
    });
  }

  const pageAllSelected = rows.length > 0 && rows.every((c) => selected[c.mobile]);

  return (
    <div className="space-y-3">
      {/* Search + filter + export — one compact bar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <form
          className="relative flex-1 lg:max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: search.trim() || null, page: 1 });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, mobile, area or site address…"
            className="h-10 w-full rounded-lg border bg-background pl-9 pr-20 text-sm"
            aria-label="Search customers"
          />
          <button type="submit" className="absolute right-1 top-1 h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">
            {navigating ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
          </button>
        </form>
        <div className="flex items-center gap-2">
          {/* Mobile: one compact filter dropdown */}
          <select
            value={filter}
            onChange={(e) => go({ filter: e.target.value, page: 1 })}
            className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm lg:hidden"
            aria-label="Filter customers"
          >
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>{f.label} ({counts[f.key] ?? 0})</option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" onClick={() => exportCsv(false)} disabled={exporting}>
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Export ({total})
          </Button>
        </div>
      </div>
      {/* Desktop: filter chips */}
      <div className="hidden flex-wrap gap-1.5 lg:flex">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => go({ filter: f.key, page: 1 })}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:border-primary/50"}`}
          >
            {f.label} <span className="opacity-70">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {selectedList.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-sm font-medium">{selectedList.length} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => exportCsv(true)} disabled={exporting}>
              <Download className="size-3.5" /> Export Selected
            </Button>
            {canCampaign && (
              <WhatsappCampaignDialog
                recipients={selectedList}
                trigger={
                  <Button type="button" size="sm">
                    <MessageCircle className="size-3.5" /> WhatsApp Campaign
                  </Button>
                }
              />
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected({})}>
              <X className="size-3.5" /> Clear
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No customers found" description={q ? "Try a different name, mobile or address." : "Change the filter to see more contacts."} />
      ) : (
        <>
          {/* Desktop table */}
          <div className={`hidden overflow-hidden rounded-xl border bg-card lg:block ${navigating ? "opacity-60" : ""}`}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 px-2">
                    <Checkbox
                      checked={pageAllSelected}
                      onCheckedChange={(v) => rows.forEach((c) => toggle(c, !!v))}
                      aria-label="Select page"
                    />
                  </TableHead>
                  <TableHead className="w-10 px-1">Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Area / Sites</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Jobs</TableHead>
                  <TableHead className="text-right">Lifetime Value</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.mobile}>
                    <TableCell className="px-2 py-1.5">
                      <Checkbox checked={!!selected[c.mobile]} onCheckedChange={(v) => toggle(c, !!v)} aria-label={`Select ${c.name}`} />
                    </TableCell>
                    <TableCell className="px-1 py-1.5 text-muted-foreground" title={c.contactType}>
                      <ContactTypeIcon type={c.contactType} />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Link href={`/customers/${c.mobile}`} className="flex flex-wrap items-center gap-1.5 font-medium hover:underline">
                        {c.name}
                        {c.isRepeat && <RepeatBadge partner={isPartner(c.contactType)} />}
                        {c.contactType !== "CUSTOMER" && <ContactTypeBadge type={c.contactType} />}
                        {c.variants > 1 && <span className="rounded bg-destructive/10 px-1 text-[10px] font-semibold text-destructive">Review duplicate</span>}
                      </Link>
                      <CustomerHistoryButton mobile={c.mobile} name={c.name} />
                    </TableCell>
                    <TableCell className="py-1.5 text-sm tabular-nums">
                      {c.mobile}
                      {c.customerNumber && <span className="block text-[11px] font-semibold text-muted-foreground">{c.customerNumber}</span>}
                    </TableCell>
                    <TableCell className="py-1.5 text-sm">
                      {c.siteCount > 1 ? `${c.siteCount} sites` : (c.area ?? "—")}
                    </TableCell>
                    <TableCell className="py-1.5 text-center text-sm">{c.leadCount}</TableCell>
                    <TableCell className="py-1.5 text-center text-sm">{c.jobCount}</TableCell>
                    <TableCell className="py-1.5 text-right text-sm tabular-nums">{formatINR(c.revenue)}</TableCell>
                    <TableCell className={`py-1.5 text-right text-sm tabular-nums ${(c.outstanding ?? 0) > 0 ? "font-semibold text-destructive" : ""}`}>
                      {formatINR(c.outstanding ?? 0)}
                    </TableCell>
                    <TableCell className="py-1.5 text-sm text-muted-foreground">{formatDate(c.lastActivity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className={`space-y-2 lg:hidden ${navigating ? "opacity-60" : ""}`}>
            {rows.map((c) => (
              <li key={c.mobile} className="rounded-xl border bg-card p-3">
                <div className="flex items-start gap-2">
                  <Checkbox className="mt-1" checked={!!selected[c.mobile]} onCheckedChange={(v) => toggle(c, !!v)} aria-label={`Select ${c.name}`} />
                  <Link href={`/customers/${c.mobile}`} className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-semibold leading-tight">
                      <span className="truncate">{c.name}</span>
                      {c.isRepeat && <RepeatBadge partner={isPartner(c.contactType)} />}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <ContactTypeBadge type={c.contactType} />
                      <span className="tabular-nums">{c.mobile}</span>
                      {c.customerNumber && <span className="font-semibold">{c.customerNumber}</span>}
                      {(c.area || c.siteCount > 1) && (
                        <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" />{c.siteCount > 1 ? `${c.siteCount} sites` : c.area}</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs">
                      Jobs {c.jobCount} · Leads {c.leadCount} · LTV <span className="font-semibold">{formatINR(c.revenue)}</span>
                      {(c.outstanding ?? 0) > 0 && <span className="font-semibold text-destructive"> · Due {formatINR(c.outstanding ?? 0)}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Last activity {formatDate(c.lastActivity)}</p>
                  </Link>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_1fr_auto_1fr] items-center gap-1.5 text-xs font-semibold">
                  <a href={toTelLink(c.mobile)} className="flex min-h-9 items-center justify-center gap-1 rounded-lg border"><Phone className="size-3.5" /> Call</a>
                  <a href={toWhatsAppLink(c.mobile)} target="_blank" rel="noreferrer" className="flex min-h-9 items-center justify-center gap-1 rounded-lg border text-emerald-700"><MessageCircle className="size-3.5" /> WhatsApp</a>
                  <CustomerHistoryButton mobile={c.mobile} name={c.name} />
                  <Link href={`/customers/${c.mobile}`} className="flex min-h-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">Open</Link>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1 || navigating} onClick={() => go({ page: page - 1 })}>
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <span className="text-muted-foreground">Page {page} of {totalPages} · {total} contacts</span>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || navigating} onClick={() => go({ page: page + 1 })}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
