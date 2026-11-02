"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";

/**
 * Single floating contact button, right margin (owner 2026-11-03) — replaces the Call Now / WhatsApp Us buttons that used to sit in
 * the header. Tap → a small pop-up with Call and WhatsApp. Performance: no images, no libraries, ~1 KB of script; the drawer is only
 * rendered while open; the pulse ring animates transform + opacity only (compositor, no repaint). Sits above the mobile bottom bar
 * (bottom-20) and the booking modal / sidebar (z-70 / z-60) stack over it. Links are plain tel: / wa.me anchors, so the marketing-tags
 * click listener still counts call_click / whatsapp_click.
 */
export function FloatingContact({ callNumber, waNumber, waText }: { callNumber: string; waNumber: string; waText: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", esc);
    window.addEventListener("pointerdown", away);
    return () => { window.removeEventListener("keydown", esc); window.removeEventListener("pointerdown", away); };
  }, [open]);

  return (
    <div ref={root} className="fixed bottom-20 right-4 z-[56] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
      {open && (
        <div role="dialog" aria-label="Contact Sahara" className="w-56 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-[#0a2540]/10">
          <p className="px-3 pb-1 pt-2 text-xs font-extrabold uppercase tracking-wide text-[#0a2540]/60">Talk to us</p>
          <a href={`tel:+91${callNumber}`} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-[#0a2540] hover:bg-[#eef4fb]"><span className="flex size-9 items-center justify-center rounded-full bg-primary text-white"><Phone className="size-4" /></span>Call Now</a>
          <a href={`https://wa.me/91${waNumber}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-extrabold text-[#0a2540] hover:bg-[#eef4fb]"><span className="flex size-9 items-center justify-center rounded-full bg-[#25D366] text-white"><MessageCircle className="size-4" /></span>WhatsApp Us</a>
        </div>
      )}
      <button type="button" aria-label={open ? "Close contact options" : "Contact us — call or WhatsApp"} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="sahara-fab relative flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg">
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
