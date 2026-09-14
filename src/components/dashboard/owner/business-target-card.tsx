"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Target, Loader2, Pencil } from "lucide-react";
import { ExpandableCard } from "./expandable-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setBusinessTarget } from "@/server/actions/business-target";
import { formatINR } from "@/lib/utils";

type BusinessTarget = {
  year: number;
  month: number;
  targetAmount: number | null;
  achieved: number;
  remaining: number | null;
  progressPercent: number | null;
  weekly: { label: string; amount: number }[];
};

export function BusinessTargetCard({ businessTarget }: { businessTarget: BusinessTarget }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(businessTarget.targetAmount ?? ""));
  const [pending, startTransition] = useTransition();

  function save() {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid target amount");
      return;
    }
    startTransition(async () => {
      const res = await setBusinessTarget(businessTarget.year, businessTarget.month, amount);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Target updated");
      setEditing(false);
      router.refresh();
    });
  }

  const pct = Math.min(businessTarget.progressPercent ?? 0, 100);

  return (
    <ExpandableCard
      trigger={
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Target className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Monthly Business Target</p>
            <p className="text-xs text-muted-foreground">
              {businessTarget.targetAmount != null
                ? `${formatINR(businessTarget.achieved)} of ${formatINR(businessTarget.targetAmount)}`
                : "No target set"}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pt-3">
        {businessTarget.targetAmount != null ? (
          <div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{businessTarget.progressPercent}% achieved</span>
              <span>{formatINR(businessTarget.remaining ?? 0)} remaining</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Set a monthly target to track progress here.</p>
        )}

        {businessTarget.weekly.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-foreground">Weekly breakdown</p>
            {businessTarget.weekly.map((w) => (
              <div key={w.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{w.label}</span>
                <span className="font-medium text-foreground">{formatINR(w.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Target amount"
              className="h-8"
            />
            <Button size="sm" onClick={save} disabled={pending}>
              {pending && <Loader2 className="size-3.5 animate-spin" />} Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" /> {businessTarget.targetAmount != null ? "Edit target" : "Set target"}
          </Button>
        )}
      </div>
    </ExpandableCard>
  );
}
