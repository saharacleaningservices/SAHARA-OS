import Link from "next/link";
import { Plus, UserPlus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LeadStageBadge } from "@/components/shared/status-badge";
import { LeadResponseTimer } from "@/components/leads/lead-response-timer";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatDateShort, formatDateTime } from "@/lib/utils";

type Row = {
  id: string;
  leadNumber: string;
  name: string;
  service: string;
  area: string;
  stage: string;
  createdAt: Date;
  serviceDate: Date | null;
  timeSlot: string | null;
  packageName: string | null;
  assignedToMe: boolean;
};

/** Francis's dashboard: new enquiries + leads assigned to him, with Create New Lead. */
export function NewLeadsCard({ rows, newCount }: { rows: Row[]; newCount: number }) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" /> New Leads
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{newCount} new</span>
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">New enquiries and leads assigned to you</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/leads">
              All my leads <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/leads/new">
              <Plus className="size-4" /> Create New Lead
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 ? (
          <EmptyState title="No new leads" description="New enquiries and leads assigned to you will show up here." />
        ) : (
          rows.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {l.name}
                  {l.assignedToMe && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Assigned to you</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.leadNumber} · {SERVICE_LABELS[l.service as keyof typeof SERVICE_LABELS] ?? l.service}
                  {l.packageName ? ` · ${l.packageName}` : ""} · {l.area}
                  {l.serviceDate ? ` · Service ${formatDateShort(l.serviceDate)}${l.timeSlot ? ` ${l.timeSlot}` : ""}` : ""}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">Received {formatDateTime(l.createdAt)} <LeadResponseTimer stage={l.stage} createdAt={l.createdAt} /></p>
              </div>
              <LeadStageBadge stage={l.stage} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
