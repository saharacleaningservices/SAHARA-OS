"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { LeadCard } from "./lead-card";
import { LeadStageBadge } from "@/components/shared/status-badge";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { deleteLead } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  SERVICE_LABELS,
  SERVICE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  LEAD_SOURCE_LABELS,
} from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";

type Lead = {
  id: string;
  leadNumber: string;
  name: string;
  mobile: string;
  area: string;
  service: string;
  source: string;
  stage: string;
  quoteAmount: number | null;
  followUpDate: Date | null;
  createdAt: Date;
  assignedStaff?: { name: string } | null;
  assignedTo?: { name: string } | null;
};

const PAGE_SIZE = 10;

export function LeadsExplorer({ leads }: { leads: Lead[] }) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [serviceFilter, setServiceFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (q) {
        const haystack = `${lead.name} ${lead.mobile} ${lead.area} ${lead.leadNumber}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (stageFilter !== "ALL" && lead.stage !== stageFilter) return false;
      if (sourceFilter !== "ALL" && lead.source !== sourceFilter) return false;
      if (serviceFilter !== "ALL" && lead.service !== serviceFilter) return false;
      return true;
    });
  }, [leads, search, stageFilter, sourceFilter, serviceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const FilterBar = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <SearchInput value={search} onChange={setSearch} placeholder="Search by name, mobile, area..." className="sm:w-64" />
      <Select value={stageFilter} onValueChange={setStageFilter}>
        <SelectTrigger size="sm" className="sm:w-40">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All stages</SelectItem>
          {LEAD_STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {LEAD_STAGE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sourceFilter} onValueChange={setSourceFilter}>
        <SelectTrigger size="sm" className="sm:w-40">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All sources</SelectItem>
          {LEAD_SOURCE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={serviceFilter} onValueChange={setServiceFilter}>
        <SelectTrigger size="sm" className="sm:w-48">
          <SelectValue placeholder="Service" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All services</SelectItem>
          {SERVICE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Tabs defaultValue="pipeline">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="table">All Leads</TabsTrigger>
        </TabsList>
        {FilterBar}
      </div>

      <TabsContent value="pipeline">
        {filtered.length === 0 ? (
          <EmptyState title="No leads match your filters" description="Try adjusting search or filters." />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {LEAD_STAGES.map((stage) => {
              const stageLeads = filtered.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="w-72 shrink-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {LEAD_STAGE_LABELS[stage]}
                    </p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {stageLeads.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {stageLeads.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        No leads
                      </div>
                    ) : (
                      stageLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="table" className="space-y-3">
        {filtered.length === 0 ? (
          <EmptyState title="No leads match your filters" description="Try adjusting search or filters." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Quote</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:underline">
                        {lead.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {lead.leadNumber} · {lead.area}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{SERVICE_LABELS[lead.service]}</TableCell>
                    <TableCell className="text-sm">{LEAD_SOURCE_LABELS[lead.source]}</TableCell>
                    <TableCell>
                      <LeadStageBadge stage={lead.stage} />
                    </TableCell>
                    <TableCell className="text-sm">{lead.quoteAmount ? formatINR(lead.quoteAmount) : "—"}</TableCell>
                    <TableCell className="text-sm">{lead.followUpDate ? formatDate(lead.followUpDate) : "—"}</TableCell>
                    <TableCell className="text-sm">{lead.assignedTo?.name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <CallButton mobile={lead.mobile} />
                        <WhatsAppButton mobile={lead.mobile} />
                        <Button variant="outline" size="icon" className="size-8" aria-label="Edit lead" asChild>
                          <Link href={`/leads/${lead.id}/edit`}>
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                        <ConfirmDeleteButton action={deleteLead} id={lead.id} entityLabel="lead" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
