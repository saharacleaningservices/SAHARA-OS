"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cancelVoucherAction, payPurchaseVoucher } from "@/server/actions/vouchers";

/** PDF link, "Pay" (purchases) and Cancel for one voucher row. */
export function VoucherRowActions({ id, isPurchase, owed, cancelled }: { id: string; isPurchase: boolean; owed: number; cancelled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(String(owed || ""));
  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.success) return void toast.error(r.error ?? "Could not save");
      toast.success(ok);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button asChild size="sm" variant="outline" className="h-8">
        <a href={`/api/vouchers/${id}/pdf`} target="_blank" rel="noreferrer"><FileText className="size-3.5" /> PDF</a>
      </Button>
      {isPurchase && !cancelled && owed > 0 && (
        <>
          <Input type="number" min={1} max={owed} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 w-24 text-xs" aria-label="Amount paid to vendor" />
          <Button size="sm" className="h-8" disabled={pending} onClick={() => run(() => payPurchaseVoucher(id, Number(amount)), "Payment recorded")}>Pay</Button>
        </>
      )}
      {!cancelled && (
        <Button size="sm" variant="ghost" className="h-8 text-destructive" disabled={pending} onClick={() => confirm("Cancel this voucher?") && run(() => cancelVoucherAction(id), "Cancelled")}>Cancel</Button>
      )}
    </div>
  );
}
