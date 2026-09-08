"use client";

import { Phone, MessageCircle } from "lucide-react";
import { toTelLink, toWhatsAppLink } from "@/lib/utils";

/**
 * Always-visible floating contact buttons for the public booking page:
 * a pulsing (blinking) Call button and a floating WhatsApp button.
 */
export function BookingFloatingContacts({
  callNumber,
  whatsappNumber,
}: {
  callNumber: string;
  whatsappNumber: string;
}) {
  return (
    <>
      <style>{`
        @keyframes sahara-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(11,94,215,0.55); }
          70% { box-shadow: 0 0 0 16px rgba(11,94,215,0); }
          100% { box-shadow: 0 0 0 0 rgba(11,94,215,0); }
        }
        .sahara-call-pulse { animation: sahara-pulse-ring 1.4s infinite; }
      `}</style>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
        <a
          href={toWhatsAppLink(whatsappNumber)}
          target="_blank"
          rel="noreferrer"
          title="Chat on WhatsApp"
          className="flex size-14 items-center justify-center rounded-full bg-success text-white shadow-xl transition hover:scale-105"
        >
          <MessageCircle className="size-7" />
        </a>
        <a
          href={toTelLink(callNumber)}
          title={`Call ${callNumber}`}
          className="sahara-call-pulse flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-xl transition hover:scale-105"
        >
          <Phone className="size-7" />
        </a>
      </div>
    </>
  );
}
