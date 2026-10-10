"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Send, FlaskConical, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isExcelFile, parseCsv, parseExcel } from "@/lib/csv-import";
import { broadcastStatus, previewBroadcast, startBroadcast, stopBroadcast } from "@/server/actions/whatsapp-campaigns";

type Contact = { mobile: string; name: string; service: string };
type Counts = { uploaded: number; invalid: number; duplicates: number; stopped: number; noConsent: number; eligible: number };
type Job = Awaited<ReturnType<typeof broadcastStatus>>;

const ALIASES = { mobile: ["mobile", "phone", "number", "whatsapp", "contact", "mobile number"], name: ["name", "customer", "customer name"], service: ["service", "last service"] };
const TEMPLATES = [
  { value: "sahara_festival_offer", label: "Festival offer (Navratri · Dussehra · Diwali)" },
] as const; // reactivation template: add once Meta approves sahara_customer_reactivation

/**
 * Admin → Marketing: CSV / Excel WhatsApp broadcast. The file only selects WHO from your
 * existing contacts — numbers without a recorded opt-in, or that replied STOP, are excluded
 * server-side. Sends run in the background at 50–100 messages/minute.
 */
export function WhatsAppBroadcastPanel({ liveEnabled }: { liveEnabled: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fileName, setFileName] = useState("");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["value"]>("sahara_festival_offer");
  const [festival, setFestival] = useState("Diwali");
  const [campaign, setCampaign] = useState("sahara_broadcast_diwali_2026");
  const [perMinute, setPerMinute] = useState(60);
  const [job, setJob] = useState<Job>(null);
  const [pending, start] = useTransition();

  // Poll progress while a broadcast runs.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const j = await broadcastStatus().catch(() => null);
      if (alive) setJob(j);
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const rows = isExcelFile(f.name) ? await parseExcel(await f.arrayBuffer(), ALIASES) : parseCsv(await f.text(), ALIASES);
    const list = rows.map((r) => ({ mobile: String(r.mobile ?? ""), name: String(r.name ?? ""), service: String(r.service ?? "") })).filter((r) => r.mobile);
    if (list.length > 5000) return void toast.error(`The file has ${list.length} rows — the limit is 5,000 per broadcast.`);
    setContacts(list);
    setFileName(f.name);
    start(async () => {
      const res = await previewBroadcast(list);
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("counts" in res) setCounts(res.counts ?? null);
    });
  }

  const run = (mode: "TEST" | "LIVE") =>
    start(async () => {
      if (mode === "LIVE" && !confirm(`Send "${TEMPLATES.find((t) => t.value === template)?.label}" to ${counts?.eligible ?? 0} opted-in contacts at ${perMinute}/minute? This cannot be undone.`)) return;
      const res = await startBroadcast({ campaign, template, festival: template === "sahara_festival_offer" ? festival : undefined, mode, perMinute, contacts });
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("success" in res) toast.success(`Broadcast started — ${res.total} recipient(s) at ${res.perMinute}/min.`);
      setJob(await broadcastStatus());
    });

  const running = job?.status === "RUNNING";
  return (
    <div className="space-y-3 rounded-xl border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">WhatsApp Broadcast — CSV / Excel</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${liveEnabled ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>Live {liveEnabled ? "ON" : "OFF"}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Columns: <b>mobile</b> (required), name, service. Only numbers that already have a recorded WhatsApp marketing opt-in in Sahara OS are messaged; STOP / unsubscribed numbers are always excluded. Max 5,000 rows.
      </p>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={onFile} />
      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={pending || running}>
        <Upload className="size-3.5" /> {fileName ? `Replace file (${fileName})` : "Upload contacts"}
      </Button>
      {counts && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
          {[
            ["Uploaded", counts.uploaded],
            ["Will receive", counts.eligible],
            ["No opt-in", counts.noConsent],
            ["STOP / opted out", counts.stopped],
            ["Invalid", counts.invalid],
            ["Duplicates", counts.duplicates],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-lg bg-muted/50 p-2">
              <p className="text-muted-foreground">{l}</p>
              <p className="text-base font-bold">{v as number}</p>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Approved template</span>
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={template} onChange={(e) => setTemplate(e.target.value as typeof template)}>
            {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        {template === "sahara_festival_offer" && (
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Festival</span>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={festival} onChange={(e) => setFestival(e.target.value)}>
              {["Navratri", "Dussehra", "Diwali"].map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        )}
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Campaign name (for tracking)</span>
          <input className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={campaign} onChange={(e) => setCampaign(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">Speed: {perMinute} messages / minute</span>
          <input type="range" min={50} max={100} step={10} value={perMinute} onChange={(e) => setPerMinute(Number(e.target.value))} className="w-full" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => run("TEST")} disabled={pending || running}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <FlaskConical className="size-3.5" />} Send test (QA number only)
        </Button>
        <Button type="button" size="sm" onClick={() => run("LIVE")} disabled={pending || running || !liveEnabled || !counts?.eligible}>
          <Send className="size-3.5" /> Start live broadcast
        </Button>
        {running && (
          <Button type="button" variant="destructive" size="sm" onClick={() => start(async () => { await stopBroadcast(); setJob(await broadcastStatus()); })}>
            <Square className="size-3.5" /> Stop
          </Button>
        )}
      </div>
      {job && (
        <p className="rounded-lg bg-muted/50 p-2 text-xs">
          <b>{job.campaign}</b> · {job.status} · {job.sent} sent · {job.failed} failed · {job.skipped} skipped of {job.total} at {job.perMinute}/min
          {job.lastError ? ` · last error: ${job.lastError}` : ""}
        </p>
      )}
    </div>
  );
}
