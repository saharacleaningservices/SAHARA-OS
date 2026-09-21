"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, MessageCircle, X } from "lucide-react";
import { SearchInput } from "@/components/shared/search-input";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { WhatsappCampaignDialog } from "@/components/customers/whatsapp-campaign-dialog";
import { downloadCsv } from "@/lib/csv-export";
import { formatINR, formatDate } from "@/lib/utils";

export type CustomerRow = {
  mobile: string;
  name: string;
  leadCount: number;
  jobCount: number;
  revenue: number;
  lastActivity: Date;
  area?: string | null;
  outstanding?: number;
  source?: string | null;
  imported?: boolean;
};

const PAGE_SIZE = 50;

function toCsvRows(rows: CustomerRow[]) {
  return rows.map((c) => ({
    Name: c.name,
    Mobile: c.mobile,
    Area: c.area ?? "",
    Leads: c.leadCount,
    Jobs: c.jobCount,
    "Lifetime Value": c.revenue,
    Outstanding: c.outstanding ?? 0,
    Source: c.source ?? "",
    "Last Activity": c.lastActivity ? new Date(c.lastActivity).toISOString().slice(0, 10) : "",
  }));
}

// Client-side search + pagination + bulk selection over the full customer
// list, the same "fetch once, page in the browser" pattern already used by
// PaymentsExplorer / the Leads explorer — so only PAGE_SIZE rows are ever
// mounted into the DOM at a time even with a large customer base.
export function CustomersExplorer({ customers, canCampaign }: { customers: CustomerRow[]; canCampaign: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => `${c.name} ${c.mobile} ${c.area ?? ""}`.toLowerCase().includes(q));
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedRows = customers.filter((c) => selected.includes(c.mobile));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, mobile or area..."
          className="sm:w-80"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(`sahara-os-customers-${new Date().toISOString().slice(0, 10)}.csv`, toCsvRows(filtered))}
        >
          <Download className="size-3.5" /> Export {search ? "Filtered" : "All"} ({filtered.length})
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-sm font-medium text-foreground">
            {selected.length} customer{selected.length === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(`sahara-os-customers-selected-${new Date().toISOString().slice(0, 10)}.csv`, toCsvRows(selectedRows))}
            >
              <Download className="size-3.5" /> Export Selected
            </Button>
            {canCampaign && (
              <WhatsappCampaignDialog
                recipients={selectedRows.map((c) => ({ name: c.name, mobile: c.mobile }))}
                trigger={
                  <Button type="button" size="sm">
                    <MessageCircle className="size-3.5" /> Send WhatsApp Campaign
                  </Button>
                }
              />
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
              <X className="size-3.5" /> Clear
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No customers found" description="Try adjusting your search." />
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 px-2">
                    <Checkbox
                      checked={pageItems.length > 0 && pageItems.every((c) => selected.includes(c.mobile))}
                      onCheckedChange={(checked) =>
                        setSelected((prev) =>
                          checked
                            ? Array.from(new Set([...prev, ...pageItems.map((c) => c.mobile)]))
                            : prev.filter((m) => !pageItems.some((c) => c.mobile === m)),
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Jobs</TableHead>
                  <TableHead className="text-right">Lifetime Value</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((c) => (
                  <TableRow key={c.mobile}>
                    <TableCell className="p-2">
                      <Checkbox
                        checked={selected.includes(c.mobile)}
                        onCheckedChange={(checked) =>
                          setSelected((prev) => (checked ? [...prev, c.mobile] : prev.filter((m) => m !== c.mobile)))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/customers/${c.mobile}`} className="font-medium text-foreground hover:underline">
                        {c.name || "Unknown"}
                      </Link>
                      {c.imported && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Imported</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.mobile}</TableCell>
                    <TableCell className="text-sm">{c.area ?? "—"}</TableCell>
                    <TableCell className="text-center text-sm">{c.leadCount}</TableCell>
                    <TableCell className="text-center text-sm">{c.jobCount}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatINR(c.revenue)}</TableCell>
                    <TableCell className={`text-right text-sm ${(c.outstanding ?? 0) > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                      {(c.outstanding ?? 0) > 0 ? formatINR(c.outstanding) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(c.lastActivity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
