import { Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toTelLink, toWhatsAppLink } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { WhatsAppTemplateMenu } from "@/components/shared/whatsapp-template-menu";
import type { QuickTemplateContext } from "@/lib/whatsapp-quick-templates";

// 44 px tap targets on phones, compact 32 px from sm up. Both render nothing when the number was withheld for this role (src/lib/redact.ts).
export function CallButton({ mobile, className }: { mobile: string; className?: string }) {
  if (!mobile) return null;
  return (
    <Button asChild variant="outline" size="icon" className={cn("size-11 sm:size-8", className)}>
      <a href={toTelLink(mobile)} title={`Call ${mobile}`} aria-label={`Call ${mobile}`}>
        <Phone className="size-4 sm:size-3.5" />
      </a>
    </Button>
  );
}

/**
 * WhatsApp quick action. Pass `context` to get the template picker (Quote follow-up / Payment reminder / On-the-way /
 * Review request); without it, it is the plain one-tap link with an optional prefilled `message`.
 */
export function WhatsAppButton({
  mobile,
  message,
  context,
  className,
}: {
  mobile: string;
  message?: string;
  context?: QuickTemplateContext;
  className?: string;
}) {
  if (!mobile) return null;
  if (context) return <WhatsAppTemplateMenu mobile={mobile} context={context} className={className} fallbackMessage={message} />;
  return (
    <Button asChild variant="outline" size="icon" className={cn("size-11 text-success hover:text-success sm:size-8", className)}>
      <a href={toWhatsAppLink(mobile, message)} target="_blank" rel="noreferrer" title={`WhatsApp ${mobile}`} aria-label={`WhatsApp ${mobile}`}>
        <MessageCircle className="size-4 sm:size-3.5" />
      </a>
    </Button>
  );
}
