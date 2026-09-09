"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark, Check, Loader2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/utils";
import { updateBankBalance } from "@/server/actions/owner";

export function OwnerBankBalanceCard({ value }: { value: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(value != null ? String(value) : "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateBankBalance(Number(amount) || 0);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Bank balance updated");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-l-4 border-l-teal-500 border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">Bank Balance</p>
        <span className="flex size-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-600">
          <Landmark className="size-4" />
        </span>
      </div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className="h-8" autoFocus />
          <button onClick={save} disabled={pending} className="text-teal-600">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-left">
          <span className="text-[1.5rem] font-bold leading-none text-foreground">
            {value != null ? formatINR(value) : "Set"}
          </span>
          <Pencil className="size-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
