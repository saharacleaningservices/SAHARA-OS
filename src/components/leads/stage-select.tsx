"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateLeadStage } from "@/server/actions/leads";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/constants";

export function StageSelect({ leadId, stage }: { leadId: string; stage: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(value: string) {
    startTransition(async () => {
      const res = await updateLeadStage(leadId, value as (typeof LEAD_STAGES)[number]);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Moved to ${LEAD_STAGE_LABELS[value]}`);
      router.refresh();
    });
  }

  return (
    <Select value={stage} onValueChange={onChange} disabled={pending}>
      <SelectTrigger size="sm" className="h-7 w-full text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEAD_STAGES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {LEAD_STAGE_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
