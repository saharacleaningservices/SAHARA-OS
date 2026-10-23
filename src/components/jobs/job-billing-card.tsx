"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/utils";
import { rebillJob } from "@/lib/invoice-tax";
import { updateJobBilling } from "@/server/actions/job-billing";

type Props = {
  jobId: string;
  jobValue: number;
  gstAmount: number;
  discountAmount: number | null;
  discountMode: string | null;
  discountValue: number | null;
  gstEnabled: boolean;
  customerGstin: string | null;
  advance: number;
  /** A completed job: the discount is a post-service adjustment (customer paid less than billed). */
  completed?: boolean;
};

/** Discount (flat ₹ / %) + optional 18% GST (CGST 9% + SGST 9%) for one booking — Admin, Accounts and Operations. */
export function JobBillingCard(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"FLAT" | "PERCENT">(p.discountMode === "PERCENT" ? "PERCENT" : "FLAT");
  const [value, setValue] = useState(p.discountValue != null ? String(p.discountValue) : p.discountAmount ? String(p.discountAmount) : "");
  const [gst, setGst] = useState(p.gstEnabled);
  const [gstin, setGstin] = useState(p.customerGstin ?? "");
  const num = Number(value) || 0;
  const t = useMemo(
    () => rebillJob({ jobValue: p.jobValue, gstAmount: p.gstAmount, discountAmount: p.discountAmount }, { discount: num > 0 ? { mode, value: num } : null, gstEnabled: gst, advancePaid: p.advance }),
    [p.jobValue, p.gstAmount, p.discountAmount, p.advance, mode, num, gst],
  );
  const save = () =>
    start(async () => {
      const res = await updateJobBilling(p.jobId, { discountMode: mode, discountValue: num, gstEnabled: gst, customerGstin: gst ? gstin : null });
      if (!res.success) return void toast.error(res.error);
      toast.success(`Billing saved — total ${formatINR(res.total)}`);
      if (res.paymentsReview) toast.message("This booking has several payment records — Accounts should review them against the new total.");
      router.refresh();
    });

  return (
    <div className="mt-3 space-y-2 rounded-lg border p-2.5 text-sm">
      <p className="flex items-center gap-1.5 font-semibold"><Percent className="size-3.5" /> {p.completed ? "Billing: post-service adjustment & GST" : "Billing: discount & GST"}</p>
      {p.completed && <p className="text-xs text-muted-foreground">Billed too much (reduced scope, goodwill)? Enter the adjustment as a flat ₹ discount — the total, the balance and the invoice update, and the invoice link can be resent.</p>}
      <div className="grid grid-cols-[auto_1fr] items-end gap-2">
        <div>
          <Label className="text-xs">Discount</Label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "FLAT" | "PERCENT")} className="h-9 rounded-md border bg-background px-2 text-sm">
            <option value="FLAT">Flat ₹</option>
            <option value="PERCENT">Percent %</option>
          </select>
        </div>
        <Input inputMode="decimal" placeholder={mode === "PERCENT" ? "e.g. 10" : "e.g. 500"} value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} aria-label="Discount value" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={gst} onChange={(e) => setGst(e.target.checked)} className="size-4" />
        Add 18% GST (B2B — CGST 9% + SGST 9%)
      </label>
      {gst && <Input placeholder="Customer GSTIN (15 characters)" value={gstin} maxLength={15} onChange={(e) => setGstin(e.target.value.toUpperCase())} aria-label="Customer GSTIN" />}
      <div className="space-y-0.5 rounded-md bg-muted/50 p-2 text-xs">
        <p className="flex justify-between"><span>Subtotal</span><span>{formatINR(t.subtotal)}</span></p>
        {t.discount > 0 && <p className="flex justify-between"><span>Discount</span><span>− {formatINR(t.discount)}</span></p>}
        {t.gst > 0 && <p className="flex justify-between"><span>GST 18% (CGST {formatINR(t.cgst)} + SGST {formatINR(t.sgst)})</span><span>{formatINR(t.gst)}</span></p>}
        <p className="flex justify-between font-bold"><span>Final total</span><span>{formatINR(t.total)}</span></p>
        <p className="flex justify-between"><span>Advance paid</span><span>{formatINR(p.advance)}</span></p>
        <p className="flex justify-between font-semibold"><span>Balance due</span><span>{formatINR(t.balanceDue)}</span></p>
      </div>
      <Button size="sm" onClick={save} disabled={pending}>{pending && <Loader2 className="size-3.5 animate-spin" />} Save billing</Button>
    </div>
  );
}
