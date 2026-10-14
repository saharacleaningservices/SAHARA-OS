"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlarmClock, CheckCircle2, Clock, IndianRupee, Settings2, BellOff, Bell, Volume2, VolumeX, FileText, PhoneCall, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/utils";
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

  const load = useCallback(async () => {
    const d = await getPendingActions().catch(() => null);
    if (d) setData(d);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
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
  const outstanding = pays.reduce((a, p) => a + p.balance, 0);
  const total = jobs.length + pays.length + quotes.length + followUps.length;

  return (
    <Card id="pending-actions" className={total ? "border-warning/60 shadow-sm" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <AlarmClock className={`size-4 ${total ? "text-warning" : "text-success"}`} />
            Pending actions
            {total > 0 && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">{total}</span>}
          </span>
          <span className="flex items-center gap-1">
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
        <p className="text-xs text-muted-foreground">
          {!data.enabled
            ? "Reminders are switched off in settings."
            : total === 0
              ? `All caught up.${data.upcomingClosures ? ` ${data.upcomingClosures} started job(s) not yet due.` : ""}`
              : `${jobs.length} job closure${jobs.length === 1 ? "" : "s"} · ${pays.length} unpaid job${pays.length === 1 ? "" : "s"}${pays.length ? ` (${formatINR(outstanding)} outstanding)` : ""} · ${quotes.length} quotation${quotes.length === 1 ? "" : "s"} · ${followUps.length} follow-up${followUps.length === 1 ? "" : "s"}. Work status and payment status are tracked separately.`}
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
        <CardContent className="space-y-4">
          {jobs.length > 0 && (
            <Section title="Started — not marked completed" icon={<Clock className="size-3.5" />}>
              {jobs.map((i) => (
                <Row key={i.id} item={i}>
                  <div className="text-xs text-muted-foreground">
                    Scheduled {fmt(i.scheduledDate).split(",")[0]} {i.scheduledTime} ·{" "}
                    {i.overdue ? `overdue ${since(i.dueAt)}` : `delayed — expected by ${fmt(i.dueAt)}`}
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
              ))}
            </Section>
          )}
          {pays.length > 0 && (
            <Section title="Completed — payment pending" icon={<IndianRupee className="size-3.5" />}>
              {pays.map((i) => (
                <Row key={i.id} item={i}>
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
                  {open?.id === i.id && open.mode === "followup" && (
                    <FollowUpForm pending={pending} onSubmit={(v) => run(() => recordPaymentFollowUp(i.id, v), "Follow-up recorded — reminders paused until then")} />
                  )}
                </Row>
              ))}
            </Section>
          )}
          {quotes.length > 0 && (
            <Section title="Quotations — follow-up needed" icon={<FileText className="size-3.5" />}>
              {quotes.map((q) => (
                <SubjectRow key={q.id} item={q} href={`/leads/${q.leadId}`} label={q.quoteNumber} title={q.leadName}>
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
              ))}
            </Section>
          )}
          {followUps.length > 0 && (
            <Section title="Customer follow-ups — due" icon={<PhoneCall className="size-3.5" />}>
              {followUps.map((f) => (
                <SubjectRow key={f.id} item={f} href={`/leads/${f.leadId}`} label={f.type} title={f.leadName}>
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
              ))}
            </Section>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SubjectRow({ item, href, label, title, children }: { item: QuoteItem | FollowUpItem; href: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <li className="p-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Link href={href} className="font-mono text-xs font-semibold text-primary hover:underline">
          {label}
        </Link>
        <span className="font-medium">{title}</span>
        {item.escalated && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">Escalated</span>}
        {item.snoozedUntil && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Snoozed till {fmt(item.snoozedUntil)}</span>}
        {item.followUpUntil && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Follow-up {fmt(item.followUpUntil)}</span>}
        {item.alertCount > 0 && <span className="text-[10px] text-muted-foreground">· {item.alertCount} reminder{item.alertCount === 1 ? "" : "s"}</span>}
        {item.acknowledgedBy && <span className="text-[10px] text-muted-foreground">· seen by {item.acknowledgedBy}</span>}
      </div>
      {children}
    </li>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </div>
      <ul className="divide-y rounded-lg border">{children}</ul>
    </div>
  );
}

function Row({ item, children }: { item: Item; children: React.ReactNode }) {
  return (
    <li className="p-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Link href={`/jobs/${item.jobId}`} className="font-mono text-xs font-semibold text-primary hover:underline">
          {item.jobNumber}
        </Link>
        <span className="font-medium">{item.customerName}</span>
        {item.escalated && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">Escalated</span>}
        {item.snoozedUntil && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Snoozed till {fmt(item.snoozedUntil)}</span>}
        {item.followUpUntil && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Follow-up {fmt(item.followUpUntil)}</span>}
        {item.alertCount > 0 && <span className="text-[10px] text-muted-foreground">· {item.alertCount} reminder{item.alertCount === 1 ? "" : "s"}</span>}
        {item.acknowledgedBy && <span className="text-[10px] text-muted-foreground">· seen by {item.acknowledgedBy}</span>}
      </div>
      {children}
    </li>
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
