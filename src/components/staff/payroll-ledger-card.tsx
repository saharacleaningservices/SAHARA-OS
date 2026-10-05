"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Wallet, Plus, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addAdvance, addFine, addReward } from "@/server/actions/staff-financial";
import { formatINR } from "@/lib/utils";
import { FINE_TYPES, REWARD_TYPES } from "@/lib/constants";

export function PayrollLedgerCard({
  staffId,
  monthLabel,
  presentDays,
  earned,
  advanceTotal,
  fineTotal,
  rewardTotal,
  netBalance,
  canManage,
}: {
  staffId: string;
  monthLabel: string;
  presentDays: number;
  earned: number;
  advanceTotal: number;
  fineTotal: number;
  rewardTotal: number;
  netBalance: number;
  canManage: boolean;
}) {
  const [dialog, setDialog] = useState<"advance" | "fine" | "reward" | null>(null);
  const [amount, setAmount] = useState("");
  const [reasonOrType, setReasonOrType] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      let res;
      if (dialog === "advance") res = await addAdvance(staffId, Number(amount), reasonOrType);
      else if (dialog === "fine") res = await addFine(staffId, reasonOrType, Number(amount), notes);
      else if (dialog === "reward") res = await addReward(staffId, reasonOrType, Number(amount), notes);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved");
      setDialog(null);
      setAmount("");
      setReasonOrType("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4" /> Payroll — {monthLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Present Days</p>
            <p className="font-medium text-foreground">{presentDays}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Earned</p>
            <p className="font-medium text-foreground">{formatINR(earned)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Advances</p>
            <p className="font-medium text-destructive">-{formatINR(advanceTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fines</p>
            <p className="font-medium text-destructive">-{formatINR(fineTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rewards</p>
            <p className="font-medium text-success">+{formatINR(rewardTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net Balance</p>
            <p className="text-base font-semibold text-foreground">{formatINR(netBalance)}</p>
          </div>
        </div>

        {canManage && (
          <div className="flex gap-2 pt-1">
            {/* Advances are recorded in the Khata ledger ("Add payment" → Advance) — one entry point. */}
            <Button variant="outline" size="sm" onClick={() => setDialog("fine")}>
              <Plus className="size-3.5" /> Fine
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDialog("reward")}>
              <Award className="size-3.5" /> Reward
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog === "advance" ? "Give Advance" : dialog === "fine" ? "Add Fine" : "Add Reward"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {dialog === "advance" ? (
              <div className="space-y-1">
                <Label>Reason (optional)</Label>
                <Input value={reasonOrType} onChange={(e) => setReasonOrType(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>{dialog === "fine" ? "Fine Type" : "Reward Type"}</Label>
                <Select value={reasonOrType} onValueChange={setReasonOrType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {(dialog === "fine" ? FINE_TYPES : REWARD_TYPES).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Amount (₹)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            {dialog !== "advance" && (
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
