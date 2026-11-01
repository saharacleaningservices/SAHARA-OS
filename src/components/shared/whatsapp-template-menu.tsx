"use client";

import { MessageCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QUICK_TEMPLATES, buildQuickTemplate, type QuickTemplateContext } from "@/lib/whatsapp-quick-templates";
import { toWhatsAppLink, cn } from "@/lib/utils";

/** WhatsApp button with a template picker: Quote follow-up, Payment reminder, On-the-way, Review request, or a blank chat. */
export function WhatsAppTemplateMenu({ mobile, context, className, fallbackMessage }: { mobile: string; context: QuickTemplateContext; className?: string; fallbackMessage?: string }) {
  const open = (message?: string) => window.open(toWhatsAppLink(mobile, message), "_blank", "noopener,noreferrer");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={cn("size-11 w-auto gap-0.5 px-2 text-success hover:text-success sm:size-8 sm:px-1.5", className)} aria-label={`WhatsApp ${context.name ?? ""} — choose message`} title="WhatsApp">
          <MessageCircle className="size-4 sm:size-3.5" />
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs">Send WhatsApp</DropdownMenuLabel>
        {QUICK_TEMPLATES.map((t) => (
          <DropdownMenuItem key={t.key} className="min-h-11 sm:min-h-0" onSelect={() => open(buildQuickTemplate(t.key, context))}>
            {t.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 sm:min-h-0" onSelect={() => open(fallbackMessage)}>
          Open chat (no message)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
