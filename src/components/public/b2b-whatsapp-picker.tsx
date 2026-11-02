"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

export type PickerLocality = { slug: string; name: string; pin: string; branchLocality: string; whatsapp: string; phone: string };

/**
 * Instant WhatsApp CTA for the B2B desks: pick the site's area and the message is pre-filled with area, PIN, service vertical
 * and the branch that covers it — the branch's own WhatsApp line receives it (so the CRM tags the lead's source line correctly).
 */
export function B2bWhatsAppPicker({ vertical, verticalLabel, localities, intro }: { vertical: string; verticalLabel: string; localities: PickerLocality[]; intro: string }) {
  const [slug, setSlug] = useState(localities[0]?.slug ?? "");
  const [site, setSite] = useState("");
  const l = localities.find((x) => x.slug === slug) ?? localities[0];
  if (!l) return null;
  const text = `Hi Sahara, ${intro} Area: ${l.name}, Pune (${l.pin}).${site.trim() ? ` Site: ${site.trim()}.` : ""} Service: ${verticalLabel}. Branch: ${l.branchLocality}. Ref: b2b/${vertical}/${l.slug}`;
  const href = `https://wa.me/91${l.whatsapp}?text=${encodeURIComponent(text)}`;
  const field = "h-11 w-full rounded-xl border border-[#0a2540]/15 bg-white px-3 text-sm text-[#0a2540] outline-none focus:border-primary";
  return (
    <section id="enquiry" className="scroll-mt-20 rounded-2xl bg-white p-4 shadow-sm" aria-label="WhatsApp enquiry">
      <h2 className="text-lg font-bold">Message us on WhatsApp</h2>
      <p className="mt-1 text-xs text-[#0a2540]/70">Pick the site area — we pre-fill the area, service and the branch that covers it.</p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <select className={field} value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Site area">
          {localities.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
        </select>
        <input className={field} value={site} onChange={(e) => setSite(e.target.value.slice(0, 60))} placeholder="Project / building name (optional)" aria-label="Project or building name" />
      </div>
      <p className="mt-2 text-xs text-[#0a2540]/70">Handled by the <b>{l.branchLocality}</b> branch · {l.phone}</p>
      <a href={href} target="_blank" rel="noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-success text-sm font-bold text-white"><MessageCircle className="size-4" /> Start WhatsApp chat</a>
    </section>
  );
}
