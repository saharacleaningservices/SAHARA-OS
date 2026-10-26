"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOpsReminderSettings, runOpsRemindersNow } from "@/server/actions/ops-reminders";

type Settings = {
  enabled: boolean;
  jobIntervalMin: number;
  paymentIntervalMin: number;
  escalateAfterMin: number;
  defaultJobHours: number;
  paymentLookbackDays: number;
  quietStart: string;
  quietEnd: string;
  soundEnabled: boolean;
  maxSnoozeMin: number;
  dailySummaryHour: number;
  eodSummaryTime: string;
  quotationFollowUpDays: number;
  followUpIntervalMin: number;
  staffSignupNeedsApproval: boolean;
};
type HistoryRow = { id: string; type: string; note: string | null; actorName: string | null; createdAt: string; kind: string | null; jobId: string | null; jobNumber: string | null };
type NumKey = "jobIntervalMin" | "paymentIntervalMin" | "escalateAfterMin" | "defaultJobHours" | "paymentLookbackDays" | "maxSnoozeMin" | "dailySummaryHour" | "quotationFollowUpDays" | "followUpIntervalMin";
type BoolKey = "enabled" | "soundEnabled" | "staffSignupNeedsApproval";

const NUMBERS: { key: NumKey; label: string; hint: string }[] = [
  { key: "jobIntervalMin", label: "Job-closure repeat (min)", hint: "Repeat while a started job is past its expected finish" },
  { key: "paymentIntervalMin", label: "Payment repeat (min)", hint: "Repeat while a completed job has a balance" },
  { key: "escalateAfterMin", label: "Escalate to Super Admin after (min)", hint: "Once per pending action" },
  { key: "defaultJobHours", label: "Expected job duration (h)", hint: "Slot start + this = expected finish" },
  { key: "paymentLookbackDays", label: "Track unpaid jobs completed in the last (days)", hint: "Older dues stay on the Payments page" },
  { key: "maxSnoozeMin", label: "Max snooze (min)", hint: "" },
  { key: "dailySummaryHour", label: "Daily summary hour (IST, −1 = off)", hint: "0–23" },
  { key: "quotationFollowUpDays", label: "Quotation needs follow-up after (days)", hint: "Sent quotations older than this are reminded until their status changes" },
  { key: "followUpIntervalMin", label: "Quotation / customer follow-up repeat (min)", hint: "Repeat while a follow-up is overdue" },
];

const TOGGLES: { key: BoolKey; label: string }[] = [
  { key: "enabled", label: "Reminders on" },
  { key: "soundEnabled", label: "Alert sound in the CRM (master switch — each user also has their own Sound switch)" },
  { key: "staffSignupNeedsApproval", label: "Staff App self-registration needs Super Admin / Accounts approval" },
];

export function OpsReminderSettingsForm({ initial, updatedBy, history }: { initial: Settings; updatedBy: string | null; history: HistoryRow[] }) {
  const router = useRouter();
  const [v, setV] = useState<Settings>(initial);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await updateOpsReminderSettings(v);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("Settings saved");
      router.refresh();
    });
  const runNow = () =>
    start(async () => {
      const res = await runOpsRemindersNow();
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(`Sweep done: ${JSON.stringify("result" in res ? res.result : {})}`);
      router.refresh();
    });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Settings</CardTitle>
          {updatedBy && <p className="text-xs text-muted-foreground">Last changed by {updatedBy}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {TOGGLES.map((t) => (
              <label key={t.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={v[t.key]} onChange={(e) => setV((p) => ({ ...p, [t.key]: e.target.checked }))} className="size-4" /> {t.label}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {NUMBERS.map((n) => (
              <div key={n.key} className="space-y-1">
                <Label htmlFor={n.key}>{n.label}</Label>
                <Input id={n.key} type="number" value={String(v[n.key])} onChange={(e) => setV((p) => ({ ...p, [n.key]: Number(e.target.value) }))} />
                {n.hint && <p className="text-[11px] text-muted-foreground">{n.hint}</p>}
              </div>
            ))}
            <div className="space-y-1">
              <Label htmlFor="eod">End-of-day summary time (IST)</Label>
              <Input id="eod" type="time" value={v.eodSummaryTime === "off" ? "" : v.eodSummaryTime} onChange={(e) => setV((p) => ({ ...p, eodSummaryTime: e.target.value || "off" }))} />
              <p className="text-[11px] text-muted-foreground">Pop-up for Super Admin + Accounts. Clear the field to switch it off.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="qs">Quiet hours start (IST)</Label>
              <Input id="qs" type="time" value={v.quietStart} onChange={(e) => setV((p) => ({ ...p, quietStart: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qe">Quiet hours end (IST)</Label>
              <Input id="qe" type="time" value={v.quietEnd} onChange={(e) => setV((p) => ({ ...p, quietEnd: e.target.value }))} />
              <p className="text-[11px] text-muted-foreground">No alerts or escalations in this window; they go out when it ends.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={pending}>
              Save settings
            </Button>
            <Button variant="outline" onClick={runNow} disabled={pending}>
              Run sweep now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reminder history</CardTitle>
          <p className="text-xs text-muted-foreground">Alerts, escalations, acknowledgements, snoozes, delay reasons, follow-ups and resolutions (latest 150).</p>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No reminder activity yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {history.map((h) => (
                <li key={h.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{h.type}</span>
                    {h.jobNumber && h.jobId && (
                      <Link href={`/jobs/${h.jobId}`} className="font-mono text-xs text-primary hover:underline">
                        {h.jobNumber}
                      </Link>
                    )}
                    {h.kind && <span className="text-[10px] text-muted-foreground">{{ JOB_CLOSURE: "closure", PAYMENT_COLLECTION: "payment", QUOTATION_FOLLOWUP: "quotation", FOLLOWUP_DUE: "follow-up" }[h.kind] ?? h.kind}</span>}
                    <span className="ml-auto text-[11px] text-muted-foreground">{new Date(h.createdAt).toLocaleString("en-IN")}</span>
                  </div>
                  {h.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {h.note}
                      {h.actorName ? ` — ${h.actorName}` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
