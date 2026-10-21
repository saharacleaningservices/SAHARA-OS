"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closePastPaidJobs } from "@/server/actions/past-jobs";

type Row = { id: string; jobNumber: string; customerName: string; service: string; date: string; status: string; paid: number };

export function PastJobsCloser({ rows }: { rows: Row[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const all = picked.size === rows.length && rows.length > 0;
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function run() {
    if (!picked.size) return;
    if (!confirm(`Mark ${picked.size} job(s) as Completed? No customer messages are sent. This is recorded in each job's history.`)) return;
    start(async () => {
      const res = await closePastPaidJobs([...picked]);
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("closed" in res) toast.success(`${res.closed} job(s) closed${res.skipped ? `, ${res.skipped} skipped (no longer eligible)` : ""}`);
      setPicked(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(rows.map((r) => r.id)))} /> Select all ({rows.length})
        </label>
        <Button size="sm" onClick={run} disabled={pending || picked.size === 0}>
          {pending && <Loader2 className="animate-spin" />} Mark {picked.size || ""} selected as Completed
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-2" /><th className="p-2">Job</th><th className="p-2">Customer</th><th className="p-2">Service date</th><th className="p-2">Status now</th><th className="p-2 text-right">Paid (₹)</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2"><input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.jobNumber}`} /></td>
                <td className="p-2 font-medium">{r.jobNumber}</td>
                <td className="p-2">{r.customerName}</td>
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.status.replaceAll("_", " ")}</td>
                <td className="p-2 text-right tabular-nums">{r.paid.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
