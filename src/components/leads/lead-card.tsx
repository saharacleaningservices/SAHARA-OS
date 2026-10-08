import Link from "next/link";
import { MapPin } from "lucide-react";
import { CallButton, WhatsAppButton } from "@/components/shared/quick-actions";
import { QuotationDialog } from "./quotation-dialog";
import { ScheduleVisitDialog } from "./schedule-visit-dialog";
import { StageSelect } from "./stage-select";
import { SERVICE_LABELS, LEAD_SOURCE_LABELS } from "@/lib/constants";
import { formatINR, formatDate, dayBucket, DAY_BUCKET_META } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type LeadCardData = {
  id: string;
  name: string;
  mobile: string;
  area: string;
  service: string;
  source: string;
  stage: string;
  quoteAmount: number | null;
  followUpDate: Date | null;
  serviceDate?: Date | null;
  teamNumber?: number | null;
  assignedStaff?: { name: string } | null;
  assignedStaffNames?: string[];
};

export function LeadCard({ lead }: { lead: LeadCardData }) {
  const isJob = lead.stage === "JOB_SCHEDULED" || lead.stage === "COMPLETED";
  const smart = isJob ? lead.serviceDate ?? null : lead.followUpDate;
  const bucket = dayBucket(smart);
  const meta = bucket === "OVERDUE" || bucket === "TODAY" || bucket === "TOMORROW" ? DAY_BUCKET_META[bucket] : null;
  const isTodayJob = bucket === "TODAY" && lead.stage === "JOB_SCHEDULED";
  const crew = lead.assignedStaffNames?.length
    ? lead.assignedStaffNames
    : lead.assignedStaff?.name
      ? [lead.assignedStaff.name]
      : [];

  return (
    <div className={`space-y-1.5 rounded-lg border bg-card p-2.5 sahara-shadow ${isTodayJob ? "border-success ring-1 ring-success/40" : "border-border"}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="min-w-0 hover:underline">
          <p className="truncate text-sm font-semibold text-foreground">{lead.name}</p>
        </Link>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {LEAD_SOURCE_LABELS[lead.source]}
        </Badge>
      </div>

      <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="size-3 shrink-0" /> <span className="truncate">{lead.area} · {SERVICE_LABELS[lead.service]}</span>
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {lead.quoteAmount ? formatINR(lead.quoteAmount) : "—"}
        </span>
        {isTodayJob ? (
          <Badge variant="success" className="text-[10px]">🟢 TODAY JOB</Badge>
        ) : meta ? (
          <Badge variant={meta.badge} className="text-[10px]">
            {bucket === "TOMORROW" ? "🔵 " : bucket === "OVERDUE" ? "🔴 " : "🟢 "}
            {meta.label} · {smart ? formatDate(smart) : ""}
          </Badge>
        ) : smart ? (
          <span className="text-[11px] text-muted-foreground">{isJob ? "Job" : "FU"} {formatDate(smart)}</span>
        ) : null}
      </div>

      {(lead.teamNumber || crew.length > 0) && (
        <p className="text-[11px] text-muted-foreground">
          {lead.teamNumber ? `Team ${lead.teamNumber}` : ""}
          {lead.teamNumber && crew.length ? " · " : ""}
          {crew.join(", ")}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <StageSelect leadId={lead.id} stage={lead.stage} />
        </div>
        <CallButton mobile={lead.mobile} />
        <WhatsAppButton
          mobile={lead.mobile}
          message={`Hi ${lead.name}, this is Sahara Cleaning Services regarding your ${SERVICE_LABELS[lead.service]} enquiry.`}
        />
        <QuotationDialog
          leadId={lead.id}
          service={lead.service}
          suggestedAmount={lead.quoteAmount}
          area={lead.area}
          trigger={
            <button className="rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-accent">
              Quote
            </button>
          }
        />
        <ScheduleVisitDialog
          leadId={lead.id}
          trigger={
            <button className="rounded-md border border-input px-2 py-1 text-[11px] font-medium hover:bg-accent">
              Visit
            </button>
          }
        />
      </div>
    </div>
  );
}
