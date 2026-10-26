"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createRepeatBooking } from "@/server/actions/leads";

export function RepeatBookingButton({ mobile }: { mobile: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      const res = await createRepeatBooking(mobile);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Repeat booking ${res.leadNumber} created`);
      router.push(`/leads/${res.leadId}`);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={go} disabled={pending}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      Repeat Booking
    </Button>
  );
}
