import { Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toTelLink, toWhatsAppLink } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Renders nothing when the number was withheld for this role (src/lib/redact.ts).
export function CallButton({ mobile, className }: { mobile: string; className?: string }) {
  if (!mobile) return null;
  return (
    <Button asChild variant="outline" size="icon" className={cn("size-8", className)}>
      <a href={toTelLink(mobile)} title={`Call ${mobile}`}>
        <Phone className="size-3.5" />
      </a>
    </Button>
  );
}

export function WhatsAppButton({
  mobile,
  message,
  className,
}: {
  mobile: string;
  message?: string;
  className?: string;
}) {
  if (!mobile) return null;
  return (
    <Button asChild variant="outline" size="icon" className={cn("size-8 text-success hover:text-success", className)}>
      <a href={toWhatsAppLink(mobile, message)} target="_blank" rel="noreferrer" title={`WhatsApp ${mobile}`}>
        <MessageCircle className="size-3.5" />
      </a>
    </Button>
  );
}
