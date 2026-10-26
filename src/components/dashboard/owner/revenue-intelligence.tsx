"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet, AlertTriangle, Loader2, MessageCircle } from "lucide-react";
import { ExpandableCard } from "./expandable-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { recordCollection, recordReminder } from "@/server/actions/payments";
import { formatINR, formatDate, toWhatsAppLink } from "@/lib/utils";

type OverduePayment = {
  id: string;
  clientName: string;
  clientMobile?: string | null;
  amount: number;
  paidAmount: number;
  outstanding: number;
  dueDate: string | Date;
  invoiceNumber: string;
};

export function RevenueIntelligence({
  revenue,
  overduePayments,
}: {
  revenue: {
    monthlyRevenue: number;
    balancePending: number;
    advanceCollectedToday: number;
    todaysCollection: number;
  };
  overduePayments: OverduePayment[];
}) {
  const router = useRouter();
  const [payDialog, setPayDialog] = useState<OverduePayment | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"UPI" | "QR" | "BANK" | "CASH">("UPI");
  const [pending, startTransition] = useTransition();

  function openPay(p: OverduePayment) {
    setPayDialog(p);
    setAmount(String(p.outstanding));
  }

  function submitPay(full: boolean) {
    if (!payDialog) return;
    startTransition(async () => {
      const res = await recordCollection(payDialog.id, {
        amount: full ? undefined : Number(amount) || 0,
        mode,
        full,
      });
      if (!res.success) {
        toast.error(res.error ?? "Could not record payment");
        return;
      }
      toast.success(`Collected ${formatINR(res.collected)}`);
      setPayDialog(null);
      router.refresh();
    });
  }

  function sendReminder(p: OverduePayment) {
    startTransition(async () => {
      await recordReminder(p.id, "WHATSAPP");
      router.refresh();
    });
    if (p.clientMobile) {
      const msg = `Hi ${p.clientName}, this is a payment reminder from Sahara Cleaning Services. Invoice ${p.invoiceNumber} of ${formatINR(p.outstanding)} is overdue. Kindly clear at your earliest convenience.`;
      window.open(toWhatsAppLink(p.clientMobile, msg), "_blank");
    } else {
      toast.success("Reminder logged");
    }
  }

  return (
    <>
      <ExpandableCard
        trigger={
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Revenue Intelligence</p>
              <p className="text-xs text-muted-foreground">
                {formatINR(revenue.monthlyRevenue)} this month · {formatINR(revenue.balancePending)} pending
              </p>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-lg font-semibold text-foreground">{formatINR(revenue.monthlyRevenue)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Pending Collection</p>
            <p className="text-lg font-semibold text-foreground">{formatINR(revenue.balancePending)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Advance Received Today</p>
            <p className="text-lg font-semibold text-foreground">{formatINR(revenue.advanceCollectedToday)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Today&apos;s Collection</p>
            <p className="text-lg font-semibold text-foreground">{formatINR(revenue.todaysCollection)}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <AlertTriangle className="size-3.5 text-destructive" /> Overdue Payments ({overduePayments.length})
          </p>
          {overduePayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing overdue.</p>
          ) : (
            overduePayments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.clientName}</p>
                  <p className="truncate text-xs text-destructive">
                    {p.invoiceNumber} · Due {formatDate(p.dueDate)} · {formatINR(p.outstanding)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    onClick={() => sendReminder(p)}
                    title="Send reminder"
                  >
                    <MessageCircle className="size-3.5" />
                  </Button>
                  <Button size="sm" onClick={() => openPay(p)}>
                    Record Payment
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ExpandableCard>

      <Dialog open={payDialog !== null} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment — {payDialog?.clientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Amount (outstanding {payDialog ? formatINR(payDialog.outstanding) : ""})
              </Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="QR">QR Scan</SelectItem>
                  <SelectItem value="BANK">Bank Transfer</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => submitPay(false)} disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} Record Amount
            </Button>
            <Button onClick={() => submitPay(true)} disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} Collect Full Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
