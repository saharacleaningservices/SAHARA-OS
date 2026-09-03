"use client";

import { useTransition } from "react";
import { Phone, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toTelLink, toWhatsAppLink, formatINR } from "@/lib/utils";
import { recordReminder } from "@/server/actions/payments";
import { COMPANY } from "@/lib/constants";

export function ReminderButtons({
  paymentId,
  clientName,
  clientMobile,
  invoiceNumber,
  amount,
}: {
  paymentId: string;
  clientName: string;
  clientMobile: string | null;
  invoiceNumber: string;
  amount: number;
}) {
  const [, startTransition] = useTransition();

  function log(channel: "WHATSAPP" | "EMAIL" | "CALL") {
    startTransition(() => {
      recordReminder(paymentId, channel);
    });
  }

  const message = `Hi ${clientName}, this is a payment reminder from ${COMPANY.name}. Invoice ${invoiceNumber} of ${formatINR(
    amount
  )} is due. Kindly clear it at your earliest convenience. Thank you!`;
  const subject = encodeURIComponent(`Payment reminder — Invoice ${invoiceNumber}`);
  const body = encodeURIComponent(message);

  return (
    <div className="flex items-center gap-1.5">
      {clientMobile && (
        <>
          <Button asChild variant="outline" size="icon" className="size-8" onClick={() => log("CALL")}>
            <a href={toTelLink(clientMobile)} title="Call">
              <Phone className="size-3.5" />
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="icon"
            className="size-8 text-success hover:text-success"
            onClick={() => log("WHATSAPP")}
          >
            <a href={toWhatsAppLink(clientMobile, message)} target="_blank" rel="noreferrer" title="WhatsApp reminder">
              <MessageCircle className="size-3.5" />
            </a>
          </Button>
        </>
      )}
      <Button asChild variant="outline" size="icon" className="size-8" onClick={() => log("EMAIL")}>
        <a href={`mailto:?subject=${subject}&body=${body}`} title="Email reminder">
          <Mail className="size-3.5" />
        </a>
      </Button>
    </div>
  );
}
