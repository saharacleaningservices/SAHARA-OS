"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerHistoryButton } from "@/components/customers/customer-history-drawer";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { LeadCard } from "./lead-card";
import { LeadStageBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { LeadResponseTimer } from "@/components/leads/lead-response-timer";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { BulkOutreachButton } from "@/components/leads/bulk-outreach-button";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteLead, bulkDeleteLeads } from "@/server/actions/leads";
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
import { formatINR, formatDateShort, dayBucket, todayTomorrowFirst, DAY_BUCKET_META } from "@/lib/utils";

type Lead = {
  id: string;
  leadNumber: string;
  customerNumber?: string | null;
  name: string;
  mobile: string;
  area: string;
  service: string;
  source: string;
  stage: string;
  quoteAmount: number | null;
  followUpDate: Date | null;
  serviceDate: Date | null;
  timeSlot?: string | null;
  teamNumber: number | null;
  createdAt: Date;
  assignedStaff?: { name: string } | null;
  assignedTo?: { name: string } | null;
  assignedStaffNames?: string[];
};

const PAGE_SIZE = 10;

/** The date that matters for this stage: service date once it's a confirmed
 * job, otherwise the follow-up date. */
function smartDate(lead: Lead) {
  if (lead.stage === "JOB_SCHEDULED" || lead.stage === "COMPLETED") {
    return { date: lead.serviceDate, kind: "Service" as const };
  }
  return { date: lead.followUpDate, kind: "Follow-up" as const };
}

function DateCell({ lead }: { lead: Lead }) {
  const { date, kind } = smartDate(lead);
  if (!date) return <span className="text-muted-foreground">—</span>;
  const bucket = dayBucket(date);
  const meta = bucket === "OVERDUE" || bucket === "TODAY" || bucket === "TOMORROW" ? DAY_BUCKET_META[bucket] : null;
  const isTodayJob = bucket === "TODAY" && (lead.stage === "JOB_SCHEDULED");
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm">
        {kind} · {formatDateShort(date)}
      </span>
      {isTodayJob ? (
        <Badge variant="success" className="w-fit text-[10px]">🟢 TODAY JOB</Badge>
      ) : meta ? (
        <Badge variant={meta.badge} className="w-fit text-[10px]">
          {bucket === "TODAY" ? "🟢 " : bucket === "TOMORROW" ? "🔵 " : "🔴 "}
          {meta.label}
        </Badge>
      ) : null}
    </div>
  );
}

function TeamCell({ lead }: { lead: Lead }) {
  const crew = lead.assignedStaffNames?.length ? lead.assignedStaffNames : lead.assignedTo?.name ? [] : [];
  return (
    <div className="text-sm">
      {lead.teamNumber ? <span className="font-medium">T{lead.teamNumber}</span> : <span className="text-muted-foreground">—</span>}
      {crew.length > 0 && <p className="text-xs text-muted-foreground">{crew.join(", ")}</p>}
    </div>
  );
}

export function LeadsExplorer({ leads }: { leads: Lead[] }) {
  const params = useSearchParams();
  const dueParam = params.get("due") ?? "";
  const stageParam = params.get("stage") ?? "";

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>(stageParam || "ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [serviceFilter, setServiceFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = leads.filter((lead) => {
      if (q) {
        const haystack = `${lead.name} ${lead.mobile} ${lead.area} ${lead.leadNumber} ${lead.customerNumber ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (stageFilter !== "ALL" && lead.stage !== stageFilter) return false;
      if (sourceFilter !== "ALL" && lead.source !== sourceFilter) return false;
      if (serviceFilter !== "ALL" && lead.service !== serviceFilter) return false;
      if (dueParam) {
        const b = dayBucket(smartDate(lead).date);
        if (dueParam === "today" && b !== "TODAY") return false;
        if (dueParam === "overdue" && b !== "OVERDUE") return false;
      }
      return true;
    });
    // Today's and tomorrow's records first (time order), then the rest.
    return todayTomorrowFirst(matches, (l) => smartDate(l).date, (l) => l.timeSlot);
  }, [leads, search, stageFilter, sourceFilter, serviceFilter, dueParam]);

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

  // Phones open on the compact list (cards); the 8-column pipeline board is one tap away.
  const [view, setView] = useState(dueParam ? "table" : "pipeline");
  useEffect(() => {
    if (!dueParam && window.matchMedia("(max-width: 639px)").matches) setView("table");
  }, [dueParam]);

  return (
    <Tabs value={view} onValueChange={setView}>
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
        <BulkActionsBar
          count={selected.length}
          entityLabel="lead"
          onClear={() => setSelected([])}
          onDelete={() => bulkDeleteLeads(selected)}
        >
          <BulkOutreachButton
            customers={leads
              .filter((l) => selected.includes(l.id))
              .map((l) => ({ id: l.id, name: l.name, mobile: l.mobile }))}
          />
        </BulkActionsBar>
        {filtered.length === 0 ? (
          <EmptyState title="No leads match your filters" description="Try adjusting search or filters." />
        ) : (
          <>
            {/* Desktop/tablet: compact table, no unnecessary horizontal
                scroll. Service+Source folded into one column (one fewer
                column) so every important field fits on a 1366px screen. */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={pageItems.length > 0 && pageItems.every((l) => selected.includes(l.id))}
                        onCheckedChange={(checked) =>
                          setSelected((prev) =>
                            checked
                              ? Array.from(new Set([...prev, ...pageItems.map((l) => l.id)]))
                              : prev.filter((id) => !pageItems.some((l) => l.id === id))
                          )
                        }
                      />
                    </TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Service / Source</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Quote</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map((lead) => (
                    <TableRow key={lead.id} className={dayBucket(smartDate(lead).date) === "TODAY" && lead.stage === "JOB_SCHEDULED" ? "bg-success/5" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(lead.id)}
                          onCheckedChange={(checked) =>
                            setSelected((prev) => (checked ? [...prev, lead.id] : prev.filter((id) => id !== lead.id)))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:underline">
                            {lead.name}
                          </Link>
                          <CustomerHistoryButton mobile={lead.mobile} name={lead.name} />
                        </span>
                        <LeadResponseTimer stage={lead.stage} createdAt={lead.createdAt} className="mb-0.5" />
                        <p className="text-xs text-muted-foreground">
                          {lead.leadNumber}{lead.customerNumber ? ` · ${lead.customerNumber}` : ""} · {lead.area}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {SERVICE_LABELS[lead.service]}
                        <p className="text-xs text-muted-foreground">{LEAD_SOURCE_LABELS[lead.source]}</p>
                      </TableCell>
                      <TableCell>
                        <LeadStageBadge stage={lead.stage} />
                      </TableCell>
                      <TableCell className="text-sm">{lead.quoteAmount ? formatINR(lead.quoteAmount) : "—"}</TableCell>
                      <TableCell><DateCell lead={lead} /></TableCell>
                      <TableCell><TeamCell lead={lead} /></TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <CallButton mobile={lead.mobile} />
                          <WhatsAppButton mobile={lead.mobile} context={{ name: lead.name, service: SERVICE_LABELS[lead.service], amount: lead.quoteAmount }} />
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
            </div>

            {/* Mobile: reuse the same LeadCard used by the Pipeline view
                instead of a wide table — one card component either way. */}
            <div className="space-y-2.5 sm:hidden">
              {pageItems.map((lead) => (
                <LeadCard key={lead.id} lead={lead} />
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
