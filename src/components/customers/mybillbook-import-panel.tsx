"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignMybillbookInvoice, importMybillbookReport } from "@/server/actions/mybillbook-import";

type Summary = { rowsInFile: number; created: number; updated: number; unchanged: number; matched: number; needsReview: number; unmatched: number; skipped: { line: number; reason: string }[] };

/** Upload the MyBillBook Sales Summary CSV (Super Admin). Re-running the same file changes nothing. */
export function MybillbookUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [summary, setSummary] = useState<Summary | null>(null);
  const run = (file: File) =>
    start(async () => {
      const res = await importMybillbookReport(await file.text());
      if (!res.success) return void toast.error(res.error);
      setSummary(res.summary);
      toast.success(`${res.summary.created} new, ${res.summary.updated} updated, ${res.summary.unchanged} unchanged`);
      router.refresh();
    });
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">Choose the MyBillBook <b>Sales Summary Report</b> (CSV). An invoice already imported is updated in place — never added twice.</p>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv,.crdownload"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) run(f);
          e.target.value = "";
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload MyBillBook CSV
      </Button>
      {summary && (
        <div className="space-y-1 text-sm">
          <p>
            <b>{summary.rowsInFile}</b> invoices read · <b>{summary.created}</b> new · <b>{summary.updated}</b> updated · <b>{summary.unchanged}</b> unchanged
          </p>
          <p>
            <b>{summary.matched}</b> attached to a customer · <b>{summary.needsReview}</b> need a choice · <b>{summary.unmatched}</b> no customer found
          </p>
          {summary.skipped.length > 0 && (
            <details className="text-xs text-amber-700">
              <summary className="cursor-pointer">{summary.skipped.length} row(s) skipped</summary>
              <ul className="mt-1 list-disc pl-4">
                {summary.skipped.slice(0, 50).map((s) => (
                  <li key={s.line}>line {s.line}: {s.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

type Candidate = { id: string; name: string; mobile: string };

/** One row of the review list: pick one of the candidate customers, or type the customer's mobile number. */
export function MybillbookReviewActions({ invoiceKey, candidates }: { invoiceKey: string; candidates: Candidate[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState("");
  const [mobile, setMobile] = useState("");
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
