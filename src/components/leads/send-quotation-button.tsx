"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getQuotationBookingLink, updateQuotationStatus } from "@/server/actions/quotations";
import { toWhatsAppLink } from "@/lib/utils";
import { documentShareMessage } from "@/lib/whatsapp-templates";

/**
 * Send a lead's quotation: the secure customer link (/booking?quote=<token> — shows the
 * quotation and lets the customer pick a slot) pre-filled in WhatsApp; staff press send.
 * A draft is marked Sent.
 */
export function SendQuotationButton({ quotationId, quoteNumber, status, name, mobile }: { quotationId: string; quoteNumber: string; status: string; name: string; mobile: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        // Open the window synchronously (popup blockers), then fill it once the link is ready.
        const w = window.open("", "_blank");
        start(async () => {
          const res = await getQuotationBookingLink(quotationId);
          if ("error" in res && res.error) {
            w?.close();
            return void toast.error(res.error);
          }
          const url = "url" in res ? res.url : "";
          const text = documentShareMessage({ customerName: name, label: "quotation", reference: quoteNumber, url: url ?? "" });
          if (w) w.location.href = toWhatsAppLink(mobile, text);
          if (status === "DRAFT") await updateQuotationStatus(quotationId, "SENT").catch(() => {});
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />} Send
    </Button>
  );
}
