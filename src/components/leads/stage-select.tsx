"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmBookingDialog } from "./confirm-booking-dialog";
import { updateLeadStage } from "@/server/actions/leads";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/constants";

type SupervisorOption = { id: string; name: string };

export function StageSelect({
  leadId,
  stage,
  supervisors = [],
  defaultServiceDate = "",
  defaultTimeSlot = "",
  defaultTeam = null,
}: {
  leadId: string;
  stage: string;
  supervisors?: SupervisorOption[];
  defaultServiceDate?: string;
  defaultTimeSlot?: string;
  defaultTeam?: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [bookingOpen, setBookingOpen] = useState(false);
  const router = useRouter();

  function onChange(value: string) {
    if (value === stage) return;
    if (value === "CONFIRMED") {
      setBookingOpen(true);
      return;
    }
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
    <>
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
      <ConfirmBookingDialog
        leadId={leadId}
        supervisors={supervisors}
        defaultServiceDate={defaultServiceDate}
        defaultTimeSlot={defaultTimeSlot}
        defaultTeam={defaultTeam}
        trigger={null}
        open={bookingOpen}
        onOpenChange={setBookingOpen}
      />
    </>
  );
}
