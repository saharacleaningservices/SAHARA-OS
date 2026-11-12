import { PhoneCall } from "lucide-react";

/**
 * Single floating Direct Call button, bottom-right (owner 2026-11-12) — replaces the speech-bubble pop-up. One unmistakable action:
 * a plain tel: anchor with a phone-handset icon, so the marketing-tags click listener counts call_click. No WhatsApp floating button.
 * Sits above the mobile bottom bar (bottom-20); the booking modal / sidebar stack over it. `waNumber` / `waText` are accepted for
 * call-site compatibility and ignored. Server component: zero client JS; the pulse ring animates transform + opacity only.
 */
export function FloatingContact({ callNumber }: { callNumber: string; waNumber?: string; waText?: string }) {
  return (
    <div className="fixed bottom-20 right-5 z-50 sm:bottom-5">
      <a href={`tel:+91${callNumber}`} aria-label="Call Sahara Cleaning Services now" className="sahara-fab relative flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg">
        <PhoneCall className="size-6" aria-hidden="true" />
      </a>
    </div>
  );
}
