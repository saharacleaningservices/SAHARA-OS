"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendTeamDispatch } from "@/server/actions/jobs";

export function SendDispatchButton({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const res = await sendTeamDispatch(jobId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.sent ? `Dispatched to ${res.sent} staff member(s)` : "Queued — WhatsApp not configured yet"
      );
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={send} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Send className="size-3.5" />} Send Team Dispatch
    </Button>
  );
}
