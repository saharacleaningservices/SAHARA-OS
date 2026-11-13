"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { officeCloseJob, officeMarkCashReceived } from "@/server/actions/jobs";
import { cn } from "@/lib/utils";

const MODES = [["UPI", "UPI / QR"], ["CASH", "Cash"], ["BANK", "Bank transfer"]] as const;

/** Office controls on a /field-ops card (Super Admin, Operations, Accounts). The server re-checks the role on every call. */
export function OfficeActions({ jobId, balance, closable, cashWithStaff }: { jobId: string; balance: number; closable: boolean; cashWithStaff: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(balance));
  const [mode, setMode] = useState<string>("");
  const [note, setNote] = useState("");

  return (
    <div className="mt-3 space-y-2">
      {cashWithStaff && (
        <button type="button" disabled={pending} className="min-h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-60"
          onClick={() => start(async () => { const r = await officeMarkCashReceived(jobId); if ("error" in r && r.error) return void toast.error(r.error); toast.success("Cash marked as received"); router.refresh(); })}>
          Cash received at office
        </button>
      )}
      {closable && !open && <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-xl border border-border bg-background px-4 text-sm font-semibold">Verify payment &amp; close job</button>}
      {closable && open && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <label className="block text-xs font-semibold">Amount received (₹)
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-base font-bold" />
          </label>
          <div className="flex flex-wrap gap-2">
            {MODES.map(([v, l]) => <button key={v} type="button" onClick={() => setMode(v)} className={cn("min-h-9 rounded-lg border px-3 text-xs font-semibold", mode === v ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{l}</button>)}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional)" className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs" />
          <div className="flex gap-2">
            <button type="button" disabled={pending || !mode || !amount} className="min-h-10 rounded-xl bg-success px-4 text-sm font-bold text-white disabled:opacity-60"
              onClick={() => start(async () => { const r = await officeCloseJob(jobId, { amount: Number(amount), mode, note }); if ("error" in r && r.error) return void toast.error(r.error); toast.success("Payment verified, job closed"); setOpen(false); router.refresh(); })}>
              Confirm &amp; close
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-xl px-3 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
