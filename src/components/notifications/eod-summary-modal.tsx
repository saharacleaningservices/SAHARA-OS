"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellOff, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { getEodSummaryForUser, dismissEodSummary } from "@/server/actions/ops-reminders";

type Data = NonNullable<Awaited<ReturnType<typeof getEodSummaryForUser>>>;

const POLL_MS = 60_000;
/** Fired by the "EOD summary" button on the dashboard's Pending-actions panel. */
const OPEN_EVENT = "sahara:open-eod-summary";

/**
 * End-of-day summary pop-up for the Super Admin and Accounts. It opens by itself once the
 * server has sent today's EOD notification (and the user has notifications ON), or on demand
 * from the dashboard. The figures are read live from the CRM, so "Got it" only marks the
 * notification as seen — it never resolves, snoozes or edits any job, payment, quotation or follow-up.
 * Other roles get null from the server and the component renders nothing.
 */
export function EodSummaryModal() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (manual = false) => {
    const d = await getEodSummaryForUser().catch(() => null);
    if (!d) return;
    setData(d);
    if (manual || d.showPopup) setOpen(true);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    const onOpen = () => void load(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, [load]);

  async function close() {
    setBusy(true);
    await dismissEodSummary().catch(() => {});
    setBusy(false);
    setOpen(false);
    setData((d) => (d ? { ...d, showPopup: false } : d));
  }

  if (!data) return null;
  const s = data.summary;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : void close())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>End-of-day summary</DialogTitle>
          <DialogDescription>
            {data.total === 0 ? "Nothing pending — everything is closed, collected and followed up." : `${data.total} item${data.total === 1 ? "" : "s"} still open. Closing this window does not resolve anything.`}
          </DialogDescription>
        </DialogHeader>

        {!data.notificationsEnabled && (
          <div className="flex items-center gap-1.5 rounded-md border border-warning/50 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning" role="status">
            <BellOff className="size-3.5" /> Notifications Disabled — you will not be alerted automatically.
          </div>
        )}

        {data.total === 0 ? (
          <p className="flex items-center gap-2 py-4 text-sm text-success">
            <CheckCircle2 className="size-4" /> All caught up.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            <Block title="Incomplete jobs (started, not completed)" count={s.incompleteJobs.count}>
              {s.incompleteJobs.items.map((j) => (
                <Line key={j.id} href={`/jobs/${j.id}`} left={`${j.jobNumber} · ${j.customerName}`} right={j.scheduledTime} />
              ))}
            </Block>
            <Block title={`Completed — unpaid (${formatINR(s.unpaidJobs.outstanding)} outstanding)`} count={s.unpaidJobs.count}>
              {s.unpaidJobs.items.map((j) => (
                <Line key={j.id} href={`/jobs/${j.id}#payments`} left={`${j.jobNumber} · ${j.customerName}`} right={formatINR(j.balance)} />
              ))}
            </Block>
            <Block title={`Open quotations (${formatINR(s.openQuotations.total)})`} count={s.openQuotations.count}>
              {s.openQuotations.items.map((q) => (
                <Line key={q.id} href={`/leads/${q.leadId}`} left={`${q.quoteNumber} · ${q.leadName}`} right={formatINR(q.amount)} />
              ))}
            </Block>
            <Block title="Overdue customer follow-ups" count={s.overdueFollowUps.count}>
              {s.overdueFollowUps.items.map((f) => (
                <Line key={f.id} href={`/leads/${f.leadId}`} left={`${f.leadName} · ${f.type.toLowerCase()}`} right={new Date(f.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} />
              ))}
            </Block>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button asChild variant="outline" size="sm" onClick={() => setOpen(false)}>
            <Link href="/dashboard#pending-actions">Open pending actions</Link>
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void close()}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Block({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">{count}</span>
      </div>
      <ul className="divide-y rounded-lg border">{children}</ul>
      {count > 10 && <p className="mt-1 text-[11px] text-muted-foreground">Showing the oldest 10 of {count}.</p>}
    </div>
  );
}

function Line({ href, left, right }: { href: string; left: string; right: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-2.5 py-1.5 hover:bg-muted/50">
        <span className="truncate">{left}</span>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{right}</span>
      </Link>
    </li>
  );
}
