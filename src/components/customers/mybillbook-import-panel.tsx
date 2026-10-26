"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignMybillbookInvoice, convertMybillbookWorkbook, createMybillbookCustomers, importMybillbookReport, previewMybillbookReport, startMybillbookDetailFetch, stopMybillbookDetailFetch } from "@/server/actions/mybillbook-import";

type Summary = { rowsInFile: number; created: number; updated: number; unchanged: number; matched: number; needsReview: number; unmatched: number; skipped: { line: number; reason: string }[] };

type Preview = Extract<Awaited<ReturnType<typeof previewMybillbookReport>>, { success: true }>["preview"];

const bytesToBase64 = (buf: ArrayBuffer) => {
  let bin = "";
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(bin);
};
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/**
 * Two steps, Super Admin only: choose a MyBillBook Sales Summary file (CSV or Excel, B2C or GST book) → see which columns were recognised
 * and what the import would do → confirm. Re-running the same file changes nothing.
 */
export function MybillbookUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dataset, setDataset] = useState<"B2C" | "GST">("B2C");
  const [file, setFile] = useState<{ name: string; csv: string; preview: Preview } | null>(null);

  const choose = (f: File) =>
    start(async () => {
      setSummary(null);
      let csv: string;
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        const conv = await convertMybillbookWorkbook(bytesToBase64(await f.arrayBuffer()));
        if (!conv.success) return void toast.error(conv.error);
        csv = conv.csv;
      } else csv = await f.text();
      const res = await previewMybillbookReport(csv);
      if (!res.success) return void toast.error(res.error);
      setFile({ name: f.name, csv, preview: res.preview });
    });

  const confirm = () =>
    start(async () => {
      if (!file) return;
      const res = await importMybillbookReport(file.csv, dataset);
      if (!res.success) return void toast.error(res.error);
      setSummary(res.summary);
      setFile(null);
      toast.success(`${res.summary.created} new, ${res.summary.updated} updated, ${res.summary.unchanged} unchanged`);
      router.refresh();
    });

  const pv = file?.preview;
  const blocked = !pv || !pv.headerFound || pv.missingRequired.length > 0 || pv.rows === 0;
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">Choose the MyBillBook <b>Sales Summary Report</b> (CSV or Excel). You see what it contains before anything is saved. An invoice already imported is updated in place — never added twice.</p>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">This file is the</span>
        <select value={dataset} onChange={(e) => setDataset(e.target.value as "B2C" | "GST")} className="h-9 rounded-md border bg-background px-2 text-sm">
          <option value="B2C">B2C book (existing customers)</option>
          <option value="GST">GST / B2B book (Sahara Cleaning Services – GST Data)</option>
        </select>
      </label>
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,.crdownload"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) choose(f);
          e.target.value = "";
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={pending} variant={pv ? "outline" : "default"}>
        {pending && !pv ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} {pv ? "Choose another file" : "Choose MyBillBook file"}
      </Button>

      {pv && file && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-semibold">{file.name}</p>
          {!pv.headerFound ? (
            <p className="text-destructive">This does not look like a MyBillBook Sales Summary report (no “Invoice No” header row).</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left uppercase text-muted-foreground"><tr><th className="py-1 pr-3">We need</th><th className="py-1 pr-3">Column in your file</th></tr></thead>
                  <tbody>
                    {pv.columns.map((c) => (
                      <tr key={c.field} className="border-t">
                        <td className="py-1 pr-3">{c.label}{c.required ? " *" : ""}</td>
                        <td className={`py-1 pr-3 ${c.header ? "" : c.required ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{c.header ?? (c.required ? "NOT FOUND" : "— not in this file")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pv.missingRequired.length > 0 && <p className="text-destructive">Missing required column(s): {pv.missingRequired.join(", ")}. Nothing can be imported from this file.</p>}
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <p><b>{pv.rows}</b> invoices · {pv.from} → {pv.to}</p>
                <p>Total billed <b>{inr(pv.totalAmount)}</b></p>
                <p><b>{pv.newRows}</b> new · <b>{pv.existingRows}</b> already stored (updated in place)</p>
                <p><b>{pv.unpaidCount}</b> unpaid · balance <b>{inr(pv.unpaidAmount)}</b></p>
                <p>{pv.withDueDate} have a due date{pv.rows - pv.withDueDate > 0 ? ` (the other ${pv.rows - pv.withDueDate} count 15 days from the invoice date)` : ""}</p>
                <p>Links: {Object.entries(pv.linkKinds).map(([k, n]) => `${n} × /${k}/`).join(" · ")}</p>
              </div>
              {pv.skipped.length > 0 && (
                <details className="text-xs text-amber-700">
                  <summary className="cursor-pointer">{pv.skipped.length} row(s) will be skipped</summary>
                  <ul className="mt-1 list-disc pl-4">{pv.skipped.slice(0, 50).map((x) => <li key={x.line}>line {x.line}: {x.reason}</li>)}</ul>
                </details>
              )}
            </>
          )}
          <div className="flex gap-2">
            <Button onClick={confirm} disabled={pending || blocked}>
              {pending && <Loader2 className="size-4 animate-spin" />} Import {pv.rows} invoices as {dataset === "GST" ? "GST / B2B" : "B2C"}
            </Button>
            <Button variant="ghost" onClick={() => setFile(null)} disabled={pending}>Cancel</Button>
          </div>
        </div>
      )}

      {summary && (
        <div className="space-y-1 text-sm">
          <p>
            <b>{summary.rowsInFile}</b> invoices read · <b>{summary.created}</b> new · <b>{summary.updated}</b> updated · <b>{summary.unchanged}</b> unchanged
          </p>
          <p>
            <b>{summary.matched}</b> attached to a customer · <b>{summary.needsReview}</b> need a choice · <b>{summary.unmatched}</b> no customer found
          </p>
          <p className="text-xs text-muted-foreground">Next: press “Read invoice details” below to fetch each invoice’s services, GST and customer mobile.</p>
        </div>
      )}
    </div>
  );
}

type Candidate = { id: string; name: string; mobile: string };

/** One row of the review list: pick one of the candidate customers, or type the customer's mobile number. */
export function MybillbookReviewActions({ invoiceKey, candidates, suggestedMobile }: { invoiceKey: string; candidates: Candidate[]; suggestedMobile?: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState("");
  const [mobile, setMobile] = useState(suggestedMobile ?? "");
  const attach = () =>
    start(async () => {
      const res = await assignMybillbookInvoice(choice ? { invoiceKey, customerId: choice } : { invoiceKey, mobile });
      if (!res.success) return void toast.error(res.error);
      toast.success(`Attached to ${res.customerName}`);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {candidates.length > 0 && (
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className="h-8 max-w-[220px] rounded-md border bg-background px-1.5 text-xs">
          <option value="">Choose a customer…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name} · {c.mobile}</option>
          ))}
        </select>
      )}
      {!choice && <Input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/[^\d+\s]/g, ""))} placeholder="or customer mobile" className="h-8 w-36 text-xs" aria-label="Customer mobile number" />}
      <Button size="sm" className="h-8" disabled={pending || (!choice && mobile.replace(/\D/g, "").length < 10)} onClick={attach}>
        {pending && <Loader2 className="size-3.5 animate-spin" />} Attach
      </Button>
    </div>
  );
}

type DetailCounts = { pending: number; done: number; failed: number; mismatch: number };
type RunState = { running: boolean; total: number; processed: number; done: number; failed: number; mismatch: number; stopReason: string | null };

/** Reads the service details of every imported invoice from its shared link (no MyBillBook login). Shows live progress while it runs. */
export function MybillbookDetailPanel({ counts, run }: { counts: DetailCounts; run: RunState }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!run.running) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [run.running, router]);
  const go = (retry: boolean) =>
    start(async () => {
      const res = await startMybillbookDetailFetch(retry);
      if (!res.success) return void toast.error(res.error);
      toast.success("Reading invoice details in the background");
      router.refresh();
    });
  const stop = () =>
    start(async () => {
      await stopMybillbookDetailFetch();
      router.refresh();
    });
  const total = counts.pending + counts.done + counts.failed + counts.mismatch;
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">
        Read each invoice&apos;s <b>service lines, date, total, balance and customer mobile</b> from its MyBillBook link, and attach it to the customer with that mobile number. No MyBillBook login is needed; it runs gently in the background and can be paused.
      </p>
      <p className="text-sm">
        <b>{counts.done}</b> of {total} read · <b>{counts.pending}</b> waiting · <b>{counts.failed}</b> could not be read · <b>{counts.mismatch}</b> differ from the report
      </p>
      {run.running && <p className="text-xs text-muted-foreground">Running: {run.processed} of {run.total} tried this run…</p>}
      {!run.running && run.stopReason && <p className="text-xs text-amber-700">{run.stopReason}</p>}
      <div className="flex flex-wrap gap-2">
        {run.running ? (
          <Button size="sm" variant="outline" onClick={stop} disabled={pending}>Pause</Button>
        ) : (
          <>
            <Button size="sm" onClick={() => go(false)} disabled={pending || counts.pending === 0}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} {counts.done > 0 ? "Continue reading details" : "Read invoice details"}
            </Button>
            {counts.failed > 0 && <Button size="sm" variant="outline" onClick={() => go(true)} disabled={pending}>Retry the {counts.failed} that failed</Button>}
          </>
        )}
      </div>
    </div>
  );
}

/** Preview, then confirm: create customer profiles for unattached invoices whose mobile was read from the invoice link. */
export function MybillbookCreateCustomers() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<{ unattached: number; noMobile: number; attachedToExisting: number; created: number; invoicesAttached: number } | null>(null);
  const run = (apply: boolean) =>
    start(async () => {
      const res = await createMybillbookCustomers(apply);
      if (!res.success) return void toast.error(res.error);
      if (!apply) return void setPreview(res.result);
      toast.success(`${res.result.created} customer profile(s) created, ${res.result.invoicesAttached} invoice(s) attached`);
      setPreview(null);
      router.refresh();
    });
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">
        Invoices still without a customer, whose <b>mobile number was read from the invoice link</b>, can get a customer profile automatically (or join the existing one with that mobile). Invoices without a mobile are never guessed.
      </p>
      {preview && (
        <p className="text-sm">
          <b>{preview.created}</b> new profiles · <b>{preview.attachedToExisting}</b> existing customers matched · <b>{preview.invoicesAttached}</b> invoices to attach · <b>{preview.noMobile}</b> stay without a mobile (of {preview.unattached})
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => run(false)} disabled={pending}>{pending && <Loader2 className="size-3.5 animate-spin" />} Preview</Button>
        {preview && preview.invoicesAttached > 0 && <Button size="sm" onClick={() => run(true)} disabled={pending}>Create {preview.created} profile(s) and attach</Button>}
      </div>
    </div>
  );
}
