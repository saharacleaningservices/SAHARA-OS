"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, MessageCircle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBookingLink } from "@/server/actions/booking-links";

type Kind = "BOOKING_FORM" | "FOLLOWUP" | "REVIEW";

const LABEL: Record<Kind, string> = {
  BOOKING_FORM: "Send Booking Form",
  FOLLOWUP: "Send Follow-up",
  REVIEW: "Send Review Request",
};

export function SendBookingFormButton({
  name,
  mobile,
  leadId,
  jobId,
  kind = "BOOKING_FORM",
  variant = "outline",
  size = "sm",
}: {
  name: string;
  mobile: string;
  leadId?: string;
  jobId?: string;
  kind?: Kind;
  variant?: "outline" | "default";
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [waUrl, setWaUrl] = useState<string | null>(null);

  function send() {
    startTransition(async () => {
      const res = await createBookingLink({ kind, name, mobile, leadId, jobId });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setWaUrl(res.waUrl);
      // Open WhatsApp with the personalized message pre-filled.
      window.open(res.waUrl, "_blank", "noopener");
      toast.success("Link created — opening WhatsApp");
      router.refresh();
    });
  }

  if (waUrl) {
    return (
      <Button variant="outline" size={size} asChild>
        <a href={waUrl} target="_blank" rel="noreferrer">
          <MessageCircle className="size-3.5" /> Open WhatsApp again
        </a>
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} onClick={send} disabled={pending}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : kind === "REVIEW" ? <ListChecks className="size-3.5" /> : <Send className="size-3.5" />}
      {LABEL[kind]}
    </Button>
  );
}
