"use client";

import { IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toWhatsAppLink } from "@/lib/utils";
import { paymentRequestMessage } from "@/lib/whatsapp-templates";
import type { CompanyPaymentDetails } from "@/components/shared/payment-details-box";

/**
 * Universal "Send Payment Link" — builds the payment-request WhatsApp message
 * (quote / advance / balance + UPI / QR / bank instructions) and opens
 * WhatsApp to the customer. Used on Booking, Lead, Job and the Payment page.
 */
export function SendPaymentLinkButton({
  mobile,
  details,
  context,
  purpose = "BALANCE",
  size = "sm",
  variant = "outline",
  label = "Send Payment Link",
  className,
}: {
  mobile: string | null | undefined;
  details: CompanyPaymentDetails;
  context: {
    customerName?: string | null;
    bookingId?: string | null;
    service?: string | null;
    packageName?: string | null;
    quote?: number | null;
    advance?: number | null;
    balance: number;
  };
  purpose?: "ADVANCE" | "BALANCE";
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "default" | "ghost" | "success";
  label?: string;
  className?: string;
}) {
  const message = paymentRequestMessage({ ...context, ...details, purpose });
  const href = mobile ? toWhatsAppLink(mobile, message) : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a href={href} target="_blank" rel="noreferrer" title="Send payment link on WhatsApp">
        <IndianRupee className="size-3.5" />
        {size !== "icon" && label}
      </a>
    </Button>
  );
}
