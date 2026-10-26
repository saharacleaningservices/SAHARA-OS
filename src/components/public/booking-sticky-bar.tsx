"use client";

import { Phone, MessageCircle, CalendarCheck, Star } from "lucide-react";
import { toTelLink, toWhatsAppLink } from "@/lib/utils";

/**
 * Always-visible action bar on the public booking page.
 * Full bar on mobile (Call / WhatsApp / Book / Reviews); floating buttons on desktop.
 */
export function BookingStickyBar({
  callNumber,
  whatsappNumber,
  reviewUrl,
}: {
  callNumber: string;
  whatsappNumber: string;
  reviewUrl?: string;
}) {
  return (
    <>
      {/* Mobile: fixed bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-border bg-white/95 backdrop-blur lg:hidden">
        <a href={toTelLink(callNumber)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-primary">
          <Phone className="size-5" /> Call
        </a>
        <a href={toWhatsAppLink(whatsappNumber)} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-success">
          <MessageCircle className="size-5" /> WhatsApp
        </a>
        <a href="#book" className="sahara-pulse flex flex-col items-center gap-0.5 rounded-lg py-2.5 text-[11px] font-semibold text-foreground">
          <CalendarCheck className="size-5" /> Book Now
        </a>
        <a
          href={reviewUrl || "#reviews"}
          target={reviewUrl ? "_blank" : undefined}
          rel={reviewUrl ? "noreferrer" : undefined}
          className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-yellow-500"
        >
          <Star className="size-5" /> Reviews
        </a>
      </div>

      {/* Desktop: floating call + whatsapp */}
      <div className="fixed bottom-5 right-5 z-50 hidden flex-col gap-3 lg:flex">
        <a href={toWhatsAppLink(whatsappNumber)} target="_blank" rel="noreferrer" title="WhatsApp"
          className="flex size-14 items-center justify-center rounded-full bg-success text-white shadow-xl transition hover:scale-105">
          <MessageCircle className="size-6" />
        </a>
        <a href={toTelLink(callNumber)} title={`Call ${callNumber}`}
          className="sahara-pulse flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-xl transition hover:scale-105">
          <Phone className="size-6" />
        </a>
      </div>
    </>
  );
}
