"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  MessageCircle,
  Phone,
  Mail,
  Copy,
  Loader2,
  Sparkles,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarClock,
  Check,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { StatCard } from "@/components/shared/stat-card";
import { formatINR, formatDate, formatDateTime, toWhatsAppLink, toTelLink } from "@/lib/utils";
import { SERVICE_LABELS, SERVICE_OPTIONS, LEAD_STAGE_LABELS } from "@/lib/constants";
import { draftQuotation } from "@/lib/ai/quotation";
import { draftPaymentReminder } from "@/lib/ai/payment-reminder";
import { rankStaffForService, type StaffCandidateInput } from "@/lib/ai/staff-suggestion";
import { buildProfitSummary, type ProfitSummaryInput } from "@/lib/ai/profit-summary";
import { suggestFollowUpAction } from "@/lib/ai/followups";
import { createQuotation, toggleFollowUpDone } from "@/server/actions/leads";
import { recordReminder } from "@/server/actions/payments";

type Lead = {
  id: string;
  leadNumber: string;
  name: string;
  mobile: string;
  area: string;
  service: string;
  stage: string;
  quoteAmount: number | null;
  // Carries any Custom Package / Individual Cleaning quantity selections
  // (see service-quantity-fields.tsx) through to draftQuotation() so the
  // suggested quotation lists them — quantity only, no price.
  notes: string | null;
};
type Payment = { id: string; invoiceNumber: string; clientName: string; clientMobile: string | null; amount: number; paidAmount: number; dueDate: Date; status: string };
type JobNeedingCrew = { id: string; jobNumber: string; customerName: string; service: string; area: string; scheduledDate: Date; scheduledTime: string; crewCount: number };
type DueFollowUp = { id: string; dueDate: Date; type: string; notes: string | null; lead: { id: string; name: string; mobile: string; area: string; service: string; stage: string } };
type StaleLead = { id: string; name: string; mobile: string; area: string; service: string; stage: string; updatedAt: Date };

function copyText(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Copied to clipboard"))
    .catch(() => toast.error("Couldn't copy — select and copy manually"));
}

export function AssistantExplorer({
  quotableLeads,
  duePayments,
  staffList,
  jobsNeedingCrew,
  dueFollowUps,
  staleLeads,
  profitInputs,
}: {
  quotableLeads: Lead[];
  duePayments: Payment[];
  staffList: StaffCandidateInput[];
  jobsNeedingCrew: JobNeedingCrew[];
  dueFollowUps: DueFollowUp[];
  staleLeads: StaleLead[];
  profitInputs: ProfitSummaryInput;
}) {
  return (
    <Tabs defaultValue="quotations">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="quotations">Draft Quotation</TabsTrigger>
        <TabsTrigger value="reminders">Payment Reminders</TabsTrigger>
        <TabsTrigger value="staffing">Staff Suggestion</TabsTrigger>
        <TabsTrigger value="profit">Daily Profit Summary</TabsTrigger>
        <TabsTrigger value="followups">Follow-up Suggestions</TabsTrigger>
      </TabsList>

      <TabsContent value="quotations" className="space-y-3">
        {quotableLeads.length === 0 ? (
          <EmptyState icon={<FileText className="size-6" />} title="No leads waiting on a quote" description="New, site-visited or negotiating leads will show up here." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {quotableLeads.map((lead) => (
              <QuotationCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="reminders" className="space-y-3">
        {duePayments.length === 0 ? (
          <EmptyState icon={<Mail className="size-6" />} title="Nothing pending" description="Every invoice is paid up." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {duePayments.map((payment) => (
              <ReminderCard key={payment.id} payment={payment} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="staffing" className="space-y-4">
        <StaffingTool staffList={staffList} jobsNeedingCrew={jobsNeedingCrew} />
      </TabsContent>

      <TabsContent value="profit">
        <ProfitSummaryCard input={profitInputs} />
      </TabsContent>

      <TabsContent value="followups" className="space-y-5">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Due or overdue follow-ups</h3>
          {dueFollowUps.length === 0 ? (
            <EmptyState icon={<CalendarClock className="size-6" />} title="No follow-ups due" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {dueFollowUps.map((f) => (
                <FollowUpCard key={f.id} lead={f.lead} followUpId={f.id} dueDate={f.dueDate} notes={f.notes} />
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Stale leads (no update in 3+ days)</h3>
          {staleLeads.length === 0 ? (
            <EmptyState icon={<Users className="size-6" />} title="No stale leads" description="Every open lead has had recent activity." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {staleLeads.map((lead) => (
                <FollowUpCard key={lead.id} lead={lead} />
              ))}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

// ── Draft Quotation ─────────────────────────────────────────────────────

function QuotationCard({ lead }: { lead: Lead }) {
  const draft = useMemo(() => draftQuotation(lead), [lead]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function generate() {
    startTransition(async () => {
      const res = await createQuotation(lead.id, draft.lineItems, draft.gstPercent);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quotation created");
      router.refresh();
      if (res.quotationId) {
        window.open(`/api/quotations/${res.quotationId}/pdf`, "_blank");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{lead.name}</CardTitle>
            <CardDescription>
              {lead.leadNumber} · {SERVICE_LABELS[lead.service]} · {lead.area}
            </CardDescription>
          </div>
          <Badge variant="info">{LEAD_STAGE_LABELS[lead.stage] ?? lead.stage}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/40 p-3 text-sm">
          <div className="flex justify-between font-medium text-foreground">
            <span>{SERVICE_LABELS[lead.service]}</span>
            <span>{formatINR(draft.total)}</span>
          </div>
        </div>
        <pre className="whitespace-pre-wrap rounded-lg border border-border p-3 text-xs text-muted-foreground font-sans">{draft.message}</pre>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={generate} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <FileText className="size-3.5" />}
            Create Quotation PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => copyText(draft.message)}>
            <Copy className="size-3.5" /> Copy message
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={toWhatsAppLink(lead.mobile, draft.message)} target="_blank" rel="noreferrer">
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Payment Reminders ───────────────────────────────────────────────────

const TONE_BADGE: Record<string, "success" | "warning" | "destructive"> = {
  friendly: "success",
  firm: "warning",
  urgent: "destructive",
};

function ReminderCard({ payment }: { payment: Payment }) {
  const draft = useMemo(() => draftPaymentReminder(payment), [payment]);
  const [, startTransition] = useTransition();

  function log(channel: "WHATSAPP" | "EMAIL" | "CALL") {
    startTransition(() => {
      recordReminder(payment.id, channel);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{payment.clientName}</CardTitle>
            <CardDescription>
              {payment.invoiceNumber} · {formatINR(draft.balance)} due {formatDate(payment.dueDate)}
            </CardDescription>
          </div>
          <Badge variant={TONE_BADGE[draft.tone]} className="capitalize">
            {draft.tone}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">{draft.whatsappMessage}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => copyText(draft.whatsappMessage)}>
            <Copy className="size-3.5" /> Copy
          </Button>
          {payment.clientMobile && (
            <>
              <Button size="sm" variant="outline" asChild onClick={() => log("WHATSAPP")}>
                <a href={toWhatsAppLink(payment.clientMobile, draft.whatsappMessage)} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild onClick={() => log("CALL")}>
                <a href={toTelLink(payment.clientMobile)}>
                  <Phone className="size-3.5" /> Call
                </a>
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" asChild onClick={() => log("EMAIL")}>
            <a href={`mailto:?subject=${encodeURIComponent(draft.emailSubject)}&body=${encodeURIComponent(draft.emailBody)}`}>
              <Mail className="size-3.5" /> Email
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Staff Suggestion ────────────────────────────────────────────────────

function StaffingTool({ staffList, jobsNeedingCrew }: { staffList: StaffCandidateInput[]; jobsNeedingCrew: JobNeedingCrew[] }) {
  const [service, setService] = useState<string>(SERVICE_OPTIONS[0]?.value ?? "HOME_DEEP_CLEANING");
  const [context, setContext] = useState<JobNeedingCrew | null>(null);

  const ranked = useMemo(() => rankStaffForService(service, staffList), [service, staffList]);

  return (
    <div className="space-y-4">
      {jobsNeedingCrew.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Jobs short on crew</p>
          <div className="flex flex-wrap gap-2">
            {jobsNeedingCrew.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => {
                  setService(job.service);
                  setContext(job);
                }}
                className="rounded-full border border-border px-3 py-1.5 text-xs hover:border-primary hover:text-primary transition-colors"
              >
                {job.jobNumber} · {job.customerName} · {formatDate(job.scheduledDate)} ({job.crewCount}/2 crew)
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Service</p>
          <Select
            value={service}
            onValueChange={(v) => {
              setService(v);
              setContext(null);
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {context && (
          <Badge variant="info">
            For {context.jobNumber} — {context.customerName}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {ranked.map((candidate, idx) => (
          <Card key={candidate.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>
                    {idx === 0 && <Sparkles className="mr-1 inline size-3.5 text-primary" />}
                    {candidate.name}
                  </CardTitle>
                  <CardDescription>{candidate.designation}</CardDescription>
                </div>
                <Badge variant={idx === 0 ? "success" : "muted"}>Score {candidate.score}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <ul className="space-y-1 text-xs text-muted-foreground">
                {candidate.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground" />
                    {r}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" asChild>
                  <a href={toTelLink(candidate.mobile)}>
                    <Phone className="size-3.5" /> Call
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={toWhatsAppLink(candidate.mobile)} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-3.5" /> WhatsApp
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Daily Profit Summary ────────────────────────────────────────────────

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus };

function ProfitSummaryCard({ input }: { input: ProfitSummaryInput }) {
  const result = useMemo(() => buildProfitSummary(input), [input]);
  const TrendIcon = TREND_ICON[result.trend];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue today" value={formatINR(input.paidToday)} tone="primary" icon={<TrendingUp className="size-4" />} />
        <StatCard label="Expenses today" value={formatINR(input.expensesToday)} tone="warning" icon={<TrendingDown className="size-4" />} />
        <StatCard
          label="Net profit today"
          value={formatINR(result.profitToday)}
          tone={result.profitToday >= 0 ? "success" : "destructive"}
          icon={<TrendIcon className="size-4" />}
        />
        <StatCard label="7-day avg profit/day" value={formatINR(input.avgDailyProfit7d)} icon={<CalendarClock className="size-4" />} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" /> Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground">{result.summary}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Follow-up Suggestions ───────────────────────────────────────────────

function FollowUpCard({
  lead,
  followUpId,
  dueDate,
  notes,
}: {
  lead: { id: string; name: string; mobile: string; area: string; service: string; stage: string };
  followUpId?: string;
  dueDate?: Date;
  notes?: string | null;
}) {
  const suggestion = useMemo(() => suggestFollowUpAction(lead), [lead]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [done, setDone] = useState(false);

  function markDone() {
    if (!followUpId) return;
    startTransition(async () => {
      await toggleFollowUpDone(followUpId, lead.id);
      setDone(true);
      router.refresh();
    });
  }

  return (
    <Card className={done ? "opacity-60" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{lead.name}</CardTitle>
            <CardDescription>
              {SERVICE_LABELS[lead.service]} · {lead.area} · {LEAD_STAGE_LABELS[lead.stage] ?? lead.stage}
            </CardDescription>
          </div>
          <Badge variant="outline">{suggestion.channelType.replace("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {dueDate && (
          <p className="text-xs text-muted-foreground">
            Due {formatDateTime(dueDate)}
            {notes ? ` · ${notes}` : ""}
          </p>
        )}
        <p className="text-sm text-foreground">{suggestion.action}</p>
        <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">{suggestion.message}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => copyText(suggestion.message)}>
            <Copy className="size-3.5" /> Copy
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={toWhatsAppLink(lead.mobile, suggestion.message)} target="_blank" rel="noreferrer">
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={toTelLink(lead.mobile)}>
              <Phone className="size-3.5" /> Call
            </a>
          </Button>
          {followUpId && !done && (
            <Button size="sm" onClick={markDone} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Check className="size-3.5" />}
              Mark done
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
