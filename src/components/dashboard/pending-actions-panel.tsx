"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlarmClock, CheckCircle2, Clock, IndianRupee, Settings2, BellOff, Bell, Volume2, VolumeX, FileText, ClipboardList, UserPlus, CalendarDays, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/utils";
import { SERVICE_LABELS } from "@/lib/constants";
import { StatusPill } from "@/components/shared/status-pill";
import {
  getPendingActions,
  acknowledgeReminder,
  snoozeReminder,
  recordJobDelay,
  completeJobFromReminder,
  recordPaymentFollowUp,
  setMyReminderPrefs,
} from "@/server/actions/ops-reminders";

type Data = NonNullable<Awaited<ReturnType<typeof getPendingActions>>>;
type Item = Data["items"][number];
type QuoteItem = Data["quotes"][number];
type FollowUpItem = Data["followUps"][number];

const REFRESH_MS = 60_000;
/** The EOD summary modal (topbar) listens for this event. */
export const OPEN_EOD_EVENT = "sahara:open-eod-summary";
/** Fired by other dashboard widgets (e.g. Quick Add Inquiry) so this panel reloads straight away instead of at the next 60 s tick. */
export const PENDING_CHANGED_EVENT = "sahara:pending-changed";

const since = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * Pending actions for Accounts (and the Super Admin): started jobs past their
 * expected finish and completed jobs with a balance. Alerts themselves come
 * from the server sweep (bell chime + push); this panel is where they're acted on.
 */
export function PendingActionsPanel() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<{ id: string; mode: "delay" | "followup" } | null>(null);
  const [pending, start] = useTransition();
  // Compact layout: every category shows its first PREVIEW rows; "View all" expands one category at a time
  // inside the card (scrollable). Only one row's action panel is open at once.
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [collapsedCat, setCollapsedCat] = useState<Record<string, boolean>>({});
  const [openRow, setOpenRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await getPendingActions().catch(() => null);
    if (d) setData(d);
  }, []);

  useEffect(() => {
    void load();
    // Poll only while the tab is visible (no sounds/notifications come from this panel); catch up on return.
    const id = setInterval(() => document.visibilityState === "visible" && void load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    const onChanged = () => void load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(PENDING_CHANGED_EVENT, onChanged);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(PENDING_CHANGED_EVENT, onChanged);
    };
  }, [load]);

  // Per-user switches (stored on the account). They only change alerts — tracking and the list below are unaffected.
  function savePref(patch: { soundEnabled?: boolean; notificationsEnabled?: boolean }) {
    start(async () => {
      const res = await setMyReminderPrefs(patch);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(patch.soundEnabled !== undefined ? `Reminder sound ${patch.soundEnabled ? "ON" : "OFF"}` : `Reminder notifications ${patch.notificationsEnabled ? "ON" : "OFF"}`);
      await load();
    });
  }

  const run = (fn: () => Promise<{ error?: string } | { success: true }>, ok: string) =>
    start(async () => {
      const res = (await fn()) as { error?: string };
      if (res.error) return void toast.error(res.error);
      toast.success(ok);
      setOpen(null);
      await load();
    });

  if (!data) return null;
  const jobs = data.items.filter((i) => i.kind === "JOB_CLOSURE");
  const pays = data.items.filter((i) => i.kind === "PAYMENT_COLLECTION");
  const quotes = data.quotes;
  const followUps = data.followUps;
  const inquiries = data.newInquiries;
  const outstanding = pays.reduce((a, p) => a + p.balance, 0);
  const followTotal = quotes.length + followUps.length;
  const total = jobs.length + pays.length + followTotal + inquiries.count;
  const toggleRow = (id: string) => setOpenRow((cur) => (cur === id ? null : id));

  const cats = [
    { id: "inquiries", label: "New Inquiries", count: inquiries.count, urgent: inquiries.count > 0 },
    { id: "followups", label: "Quotations & Follow-ups", count: followTotal, urgent: followTotal > 0 },
    { id: "payments", label: "Pending Payments", count: pays.length, urgent: pays.some((p) => p.escalated) },
    { id: "jobs", label: "Pending Jobs / Work", count: jobs.length, urgent: jobs.some((j) => j.escalated) },
  ];
  const jumpTo = (id: string) => {
    setCollapsedCat((c) => ({ ...c, [id]: false }));
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
  };

  const inquiryRows = inquiries.items.map((l) => (
    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm">
      <div className="min-w-0">
        <Link href={`/leads/${l.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
          {l.leadNumber}
        </Link>{" "}
        <span className="font-medium">{l.name}</span>
        <p className="truncate text-xs text-muted-foreground">
          {SERVICE_LABELS[l.service as keyof typeof SERVICE_LABELS] ?? l.service} · received {since(l.createdAt)} ago{l.assignedTo ? ` · ${l.assignedTo}` : ""}
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={`/leads/${l.id}`}>Open</Link>
      </Button>
    </li>
  ));

  const followRows = [
    ...quotes.map((q) => (
      <SubjectRow key={q.id} item={q} href={`/leads/${q.leadId}`} label={q.quoteNumber} title={q.leadName} summary={`Quotation ${formatINR(q.amount)} · follow-up due ${since(q.dueAt)} ago`} open={openRow === q.id} onToggle={() => toggleRow(q.id)}>
        <div className="text-xs text-muted-foreground">
          {formatINR(q.amount)} · follow-up due {since(q.dueAt)} ago{q.followUpNote ? ` · last note: ${q.followUpNote}` : ""}. Closes when the quotation is accepted, rejected, expired or cancelled.
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Button asChild size="sm">
            <Link href={`/leads/${q.leadId}`}>Open lead</Link>
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen({ id: q.id, mode: "followup" })}>
            Log follow-up
          </Button>
          <Common item={q} max={data.maxSnoozeMin} pending={pending} run={run} />
        </div>
        {open?.id === q.id && open.mode === "followup" && <FollowUpForm pending={pending} onSubmit={(v) => run(() => recordPaymentFollowUp(q.id, v), "Follow-up noted — reminders paused until then")} />}
      </SubjectRow>
    )),
    ...followUps.map((f) => (
      <SubjectRow key={f.id} item={f} href={`/leads/${f.leadId}`} label={f.type} title={f.leadName} summary={`Follow-up due ${since(f.dueAt)} ago${f.notes ? ` · ${f.notes}` : ""}`} open={openRow === f.id} onToggle={() => toggleRow(f.id)}>
        <div className="text-xs text-muted-foreground">
          Due {since(f.dueAt)} ago{f.notes ? ` · ${f.notes}` : ""}. Closes when the follow-up is marked done on the lead.
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Button asChild size="sm">
            <Link href={`/leads/${f.leadId}`}>Open lead</Link>
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen({ id: f.id, mode: "followup" })}>
            Log note
          </Button>
          <Common item={f} max={data.maxSnoozeMin} pending={pending} run={run} />
        </div>
        {open?.id === f.id && open.mode === "followup" && <FollowUpForm pending={pending} onSubmit={(v) => run(() => recordPaymentFollowUp(f.id, v), "Note saved — reminders paused until then")} />}
      </SubjectRow>
    )),
  ];

  const payRows = pays.map((i) => (
    <Row key={i.id} item={i} summary={`${formatINR(i.balance)} balance of ${formatINR(i.amountDue)}`} open={openRow === i.id} onToggle={() => toggleRow(i.id)}>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Amount due</div>
          <div className="font-semibold">{formatINR(i.amountDue)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Received</div>
          <div className="font-semibold">{formatINR(i.amountReceived)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Balance</div>
          <div className="font-semibold text-destructive">{formatINR(i.balance)}</div>
        </div>
      </div>
      {i.followUpNote && <div className="mt-1 text-xs text-muted-foreground">Last follow-up: {i.followUpNote}</div>}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Button asChild size="sm">
          <Link href={`/jobs/${i.jobId}#payments`}>Record payment</Link>
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen({ id: i.id, mode: "followup" })}>
          Log follow-up
        </Button>
        <Common item={i} max={data.maxSnoozeMin} pending={pending} run={run} />
      </div>
      {open?.id === i.id && open.mode === "followup" && <FollowUpForm pending={pending} onSubmit={(v) => run(() => recordPaymentFollowUp(i.id, v), "Follow-up recorded — reminders paused until then")} />}
    </Row>
  ));

  const jobRows = jobs.map((i) => (
    <Row key={i.id} item={i} summary={`${i.scheduledTime} · ${i.overdue ? `overdue ${since(i.dueAt)}` : `delayed — expected ${fmt(i.dueAt)}`}`} open={openRow === i.id} onToggle={() => toggleRow(i.id)}>
      <div className="text-xs text-muted-foreground">
        Scheduled {fmt(i.scheduledDate).split(",")[0]} {i.scheduledTime} · {i.overdue ? `overdue ${since(i.dueAt)}` : `delayed — expected by ${fmt(i.dueAt)}`}
        {i.delayReason && <> · reason: {i.delayReason}</>}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm(`Mark ${i.jobNumber} as completed? Only do this if the work is actually finished.`)) run(() => completeJobFromReminder(i.id), "Job marked completed");
          }}
        >
          <CheckCircle2 className="size-3.5" /> Mark completed
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setOpen({ id: i.id, mode: "delay" })}>
          Delay reason
        </Button>
        <Common item={i} max={data.maxSnoozeMin} pending={pending} run={run} />
      </div>
      {open?.id === i.id && open.mode === "delay" && <DelayForm pending={pending} onSubmit={(v) => run(() => recordJobDelay(i.id, v), "Delay recorded")} />}
    </Row>
  ));

  const catProps = (id: string) => ({
    id,
    expanded: expandedCat === id,
    collapsed: Boolean(collapsedCat[id]),
    onExpand: () => setExpandedCat((c) => (c === id ? null : id)),
    onCollapse: () => setCollapsedCat((c) => ({ ...c, [id]: !c[id] })),
  });

  return (
    <Card id="pending-actions" className={total ? "border-warning/60 shadow-sm" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <AlarmClock className={`size-4 ${total ? "text-warning" : "text-success"}`} />
            Pending actions
            {total > 0 && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">{total}</span>}
          </span>
          <span className="flex flex-wrap items-center gap-1">
            <Button asChild variant="ghost" size="sm" title="Jump to the calendar">
              <a href="#schedule">
                <CalendarDays className="size-4" /> <span className="hidden sm:inline">Calendar</span>
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new Event(OPEN_EOD_EVENT))} title="Open the end-of-day summary">
              <ClipboardList className="size-4" /> <span className="hidden sm:inline">EOD summary</span>
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => savePref({ soundEnabled: !data.userSoundEnabled })} title={data.userSoundEnabled ? "Reminder sound is ON for your account" : "Reminder sound is OFF for your account"}>
              {data.userSoundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              <span className="hidden sm:inline">{data.userSoundEnabled ? "Sound on" : "Sound off"}</span>
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => savePref({ notificationsEnabled: !data.notificationsEnabled })} title={data.notificationsEnabled ? "Reminder notifications are ON" : "Reminder notifications are OFF"}>
              {data.notificationsEnabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              <span className="hidden sm:inline">{data.notificationsEnabled ? "Alerts on" : "Alerts off"}</span>
            </Button>
            {data.role === "ADMIN" && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/reminders">
                  <Settings2 className="size-4" /> <span className="hidden sm:inline">Settings &amp; history</span>
                </Link>
              </Button>
            )}
          </span>
        </CardTitle>
        {/* Category summary: counts always visible; tap one to jump to it. Nothing is hidden — "View all" shows every item. */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pending categories">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => jumpTo(c.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-muted ${c.count && c.urgent ? "border-destructive/40 text-destructive" : "text-muted-foreground"}`}
            >
              {c.label} <span className={`rounded-full px-1.5 text-[11px] font-bold ${c.count ? (c.urgent ? "bg-destructive/10" : "bg-warning/15 text-warning") : "bg-muted"}`}>{c.count}</span>
            </button>
          ))}
          {pays.length > 0 && <span className="self-center text-xs text-muted-foreground">{formatINR(outstanding)} outstanding</span>}
        </div>
        <p className="text-xs text-muted-foreground">
          {!data.enabled ? "Reminders are switched off in settings." : total === 0 ? `All caught up.${data.upcomingClosures ? ` ${data.upcomingClosures} started job(s) not yet due.` : ""}` : "Work status and payment status are tracked separately. Oldest items first."}
        </p>
        {!data.notificationsEnabled && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning" role="status">
            <BellOff className="size-3.5" /> Notifications Disabled — no sound or pop-ups, but every pending item stays listed here.
            <Button size="sm" variant="outline" className="ml-auto h-7" disabled={pending} onClick={() => savePref({ notificationsEnabled: true })}>
              Turn on
            </Button>
          </div>
        )}
      </CardHeader>
      {total > 0 && (
        <CardContent>
          <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
            {inquiries.count > 0 && (
              <Category {...catProps("inquiries")} title="New Inquiries" icon={<UserPlus className="size-3.5" />} count={inquiries.count} rows={inquiryRows} footer={inquiries.count > inquiryRows.length ? `Showing the oldest ${inquiryRows.length} of ${inquiries.count} — open Leads for all.` : undefined} />
            )}
            {followTotal > 0 && <Category {...catProps("followups")} title="Quotations & Follow-ups" icon={<FileText className="size-3.5" />} count={followTotal} rows={followRows} />}
            {pays.length > 0 && <Category {...catProps("payments")} title="Pending Payments" icon={<IndianRupee className="size-3.5" />} count={pays.length} rows={payRows} />}
            {jobs.length > 0 && <Category {...catProps("jobs")} title="Pending Jobs / Work" icon={<Clock className="size-3.5" />} count={jobs.length} rows={jobRows} />}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

const PREVIEW = 3;

/** One category card: header (collapsible), first PREVIEW rows, and a View all / Show less control. */
function Category({
  id,
  title,
  icon,
  count,
  rows,
  expanded,
  collapsed,
  onExpand,
  onCollapse,
  footer,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  count: number;
  rows: React.ReactNode[];
  expanded: boolean;
  collapsed: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  footer?: string;
}) {
  const shown = expanded ? rows : rows.slice(0, PREVIEW);
  return (
    <section id={`cat-${id}`} className={`min-w-0 scroll-mt-20 rounded-lg border ${expanded ? "lg:col-span-2" : ""}`}>
      <button type="button" onClick={onCollapse} aria-expanded={!collapsed} aria-controls={`cat-body-${id}`} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {icon} {title}
          <span className="rounded-full bg-warning/15 px-1.5 text-[11px] font-bold text-warning">{count}</span>
        </span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <div id={`cat-body-${id}`}>
          <ul className={`divide-y border-t ${expanded ? "max-h-[60vh] overflow-y-auto" : ""}`}>{shown}</ul>
          {(rows.length > PREVIEW || footer) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-1.5">
              {footer && expanded ? <span className="text-[11px] text-muted-foreground">{footer}</span> : <span />}
              {rows.length > PREVIEW && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onExpand}>
                  {expanded ? "Show less" : `View all (${count})`}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const Badges = ({ item }: { item: { escalated: boolean; snoozedUntil: string | null; followUpUntil: string | null; alertCount: number; acknowledgedBy: string | null } }) => (
  <>
    {item.escalated && <StatusPill tone="bad" className="px-2 text-[10px]">Escalated</StatusPill>}
    {item.snoozedUntil && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Snoozed till {fmt(item.snoozedUntil)}</span>}
    {item.followUpUntil && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Follow-up {fmt(item.followUpUntil)}</span>}
    {item.alertCount > 0 && <span className="text-[10px] text-muted-foreground">· {item.alertCount} reminder{item.alertCount === 1 ? "" : "s"}</span>}
    {/* Only the acknowledger's name is stored (no role), so one colour for seen / not seen. */}
    {item.acknowledgedBy ? (
      <StatusPill tone="good" className="px-2 text-[10px]">{item.acknowledgedBy.split(" ")[0]} saw it</StatusPill>
    ) : (
      <StatusPill tone="warn" className="px-2 text-[10px]">Not seen yet</StatusPill>
    )}
  </>
);

/** Compact row: reference, name, status badges and a one-line summary; the action panel opens on demand. */
function RowShell({ link, label, title, item, summary, open, onToggle, children }: { link: string; label: string; title: string; item: Parameters<typeof Badges>[0]["item"]; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <li className="px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link href={link} className="font-mono text-xs font-semibold text-primary hover:underline">
              {label}
            </Link>
            <span className="font-medium">{title}</span>
            <Badges item={item} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{summary}</p>
        </div>
        <Button size="sm" variant={open ? "secondary" : "outline"} className="h-7 shrink-0 text-xs" aria-expanded={open} onClick={onToggle}>
          {open ? "Hide" : "Actions"}
        </Button>
      </div>
      {open && <div className="mt-2">{children}</div>}
    </li>
  );
}

function SubjectRow({ item, href, label, title, summary, open, onToggle, children }: { item: QuoteItem | FollowUpItem; href: string; label: string; title: string; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <RowShell link={href} label={label} title={title} item={item} summary={summary} open={open} onToggle={onToggle}>
      {children}
    </RowShell>
  );
}

function Row({ item, summary, open, onToggle, children }: { item: Item; summary: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <RowShell link={`/jobs/${item.jobId}`} label={item.jobNumber} title={item.customerName} item={item} summary={summary} open={open} onToggle={onToggle}>
      {children}
    </RowShell>
  );
}

function Common({ item, max, pending, run }: { item: { id: string; acknowledgedBy: string | null }; max: number; pending: boolean; run: (fn: () => Promise<{ error?: string } | { success: true }>, ok: string) => void }) {
  const options = [15, 30, 60, 120].filter((m) => m <= max);
  return (
    <>
      <select
        aria-label="Snooze"
        className="h-8 rounded-md border bg-background px-2 text-xs"
        disabled={pending}
        value=""
        onChange={(e) => e.target.value && run(() => snoozeReminder(item.id, Number(e.target.value)), "Snoozed")}
      >
        <option value="">Snooze…</option>
        {options.map((m) => (
          <option key={m} value={m}>
            {m < 60 ? `${m} min` : `${m / 60} h`}
          </option>
        ))}
      </select>
      {!item.acknowledgedBy && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => acknowledgeReminder(item.id), "Acknowledged")}>
          Acknowledge
        </Button>
      )}
    </>
  );
}

function DelayForm({ pending, onSubmit }: { pending: boolean; onSubmit: (v: { reason: string; extendMinutes: number }) => void }) {
  const [reason, setReason] = useState("");
  const [extendMinutes, setExtend] = useState(60);
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-muted/50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ reason, extendMinutes });
      }}
    >
      <Input className="h-8 min-w-48 flex-1 text-xs" placeholder="Why is it running late?" value={reason} onChange={(e) => setReason(e.target.value)} />
      <select className="h-8 rounded-md border bg-background px-2 text-xs" value={extendMinutes} onChange={(e) => setExtend(Number(e.target.value))} aria-label="Expected finish">
        {[30, 60, 90, 120, 180, 240].map((m) => (
          <option key={m} value={m}>
            finish in {m < 60 ? `${m} min` : `${m / 60} h`}
          </option>
        ))}
      </select>
      <Button size="sm" type="submit" disabled={pending}>
        Save
      </Button>
    </form>
  );
}

function FollowUpForm({ pending, onSubmit }: { pending: boolean; onSubmit: (v: { note: string; followUpDate: string }) => void }) {
  const [note, setNote] = useState("");
  const [followUpDate, setDate] = useState("");
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 rounded-md bg-muted/50 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ note, followUpDate });
      }}
    >
      <Input className="h-8 min-w-48 flex-1 text-xs" placeholder="What did the customer say?" value={note} onChange={(e) => setNote(e.target.value)} />
      <Input className="h-8 w-auto text-xs" type="datetime-local" value={followUpDate} onChange={(e) => setDate(e.target.value)} aria-label="Next follow-up" />
      <Button size="sm" type="submit" disabled={pending}>
        Save
      </Button>
    </form>
  );
}
