"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { bulkSendWhatsAppCampaign } from "@/server/actions/customer-actions";

/** Bulk WhatsApp send to a selected set of customers. Every message still
 * goes through sendWhatsApp (queued if the Cloud API isn't connected yet —
 * see src/lib/whatsapp.ts), so nothing is lost even before WhatsApp
 * credentials are configured in Settings. */
export function WhatsappCampaignDialog({
  recipients,
  trigger,
}: {
  recipients: { name: string; mobile: string }[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!message.trim()) {
      toast.error("Write a message first");
      return;
    }
    startTransition(async () => {
      const res = await bulkSendWhatsAppCampaign(recipients, message);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const parts: string[] = [];
      if (res.sent > 0) parts.push(`${res.sent} sent`);
      if (res.queued > 0) parts.push(`${res.queued} queued (WhatsApp not connected yet)`);
      if (res.failed > 0) parts.push(`${res.failed} failed`);
      toast.success(
        `Campaign: ${parts.join(", ") || "nothing to send"}${res.skipped ? ` · ${res.skipped} skipped (no marketing opt-in, or over 300 per send)` : ""}`,
      );
      setOpen(false);
      setMessage("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send WhatsApp Campaign</DialogTitle>
          <DialogDescription>
            Sends only to the selected customers who have a recorded WhatsApp marketing opt-in ({recipients.length} selected). Use{" "}
            {"{name}"} to personalize each message.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={"Hi {name}, this is Sahara Cleaning Services..."}
          rows={5}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || recipients.length === 0}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send to {recipients.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
