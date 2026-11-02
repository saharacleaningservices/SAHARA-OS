"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { HomeRow } from "@/components/public/price-selector";

// Homepage price picker, UrbanCompany style (owner 2026-11-01): tap a home size → the Premium and Platinum price cards
// (price, inclusions, Book Now) show right under the buttons. Book Now opens a light lead form (Name, Phone, Date) on the
// same page — no wizard, no page change. The lead goes to /api/leads/submit (same intake as the contact form: CRM lead +
// WhatsApp alert to the team, who call back to confirm the slot).
// No layout shift: 2 BHK is selected on load, so the cards are always there and only their contents change.
// Layout model: BOXED card inside the max-w-6xl page; cards stack on phones, sit side by side from sm.

export const OPEN_EVENT = "sahara:open-lead";
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const SIZES = ["1 BHK", "2 BHK", "3 BHK", "4 BHK+"] as const;

export type LeadIntent = {
  service: string;
  pkg?: string;
  price?: number | null;
  /** On-inspection service: the modal asks for a site visit instead of a slot. */
  inspection?: boolean;
  /** Fixed-price booking → goes through the CRM booking pipeline (server re-prices `items`, auto-confirms open slots). */
  category?: "HOME_DEEP_CLEANING" | "INDIVIDUAL_CLEANING" | "PEST_CONTROL";
  items?: { contentId: string; qty: number }[];
  propertyType?: string;
  packageName?: string;
};

/** Opens the lead form from anywhere on the page (service cards, price cards). */
export function openLead(detail: LeadIntent) {
  window.dispatchEvent(new CustomEvent<LeadIntent>(OPEN_EVENT, { detail }));
}

export function BhkPriceCards({ rows, inclusions, note, heading = "Pick your home size" }: { rows: HomeRow[]; inclusions: { Premium: string[]; Platinum: string[] }; note: string; heading?: string }) {
  const [size, setSize] = useState<(typeof SIZES)[number]>("2 BHK");
  const row = rows.find((r) => r.bhk === size);
  const chip = (on: boolean) => `min-h-11 flex-1 whitespace-nowrap rounded-xl px-2 text-sm font-bold transition sm:px-3 ${on ? "bg-primary text-white shadow" : "bg-white text-[#0a2540] ring-1 ring-[#0a2540]/15"}`;

  return (
    <section id="price-selector" aria-labelledby="price-title" className="scroll-mt-20 rounded-2xl bg-white p-3 shadow-sm sm:p-5">
      <h2 id="price-title" className="text-lg font-bold sm:text-xl">{heading}</h2>
      <p className="text-xs text-[#0a2540]/60">Full home deep cleaning · tap your home size</p>
      <div className="mt-3 flex gap-2" role="group" aria-label="Home size">
        {SIZES.map((b) => (
          <button key={b} type="button" aria-pressed={size === b} onClick={() => setSize(b)} className={chip(size === b)}>{b}</button>
        ))}
      </div>

      <div className="mt-3 grid min-h-[300px] gap-3 sm:grid-cols-2" aria-live="polite">
        {size === "4 BHK+" ? (
          <article className="flex flex-col rounded-2xl border border-[#0a2540]/10 bg-[#eef4fb] p-4 sm:col-span-2">
            <p className="text-sm font-extrabold uppercase tracking-wide text-primary">4 BHK, villa & bungalow</p>
            <p className="mt-1 text-2xl font-extrabold text-[#0a2540]">Free site inspection</p>
            <p className="mt-1 text-sm text-[#0a2540]/70">Larger homes are priced after our supervisor visits — a written quote, no obligation.</p>
            <ul className="mt-3 space-y-1.5 text-sm text-[#0a2540]/85">
              {inclusions.Platinum.map((i) => <li key={i} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{i}</li>)}
            </ul>
            <button type="button" onClick={() => openLead({ service: "Home Deep Cleaning", pkg: "4 BHK+ — site inspection", inspection: true })} className="mt-4 min-h-12 rounded-xl bg-primary text-sm font-bold text-white sm:mt-auto">Book Free Inspection</button>
          </article>
        ) : (
          (["Premium", "Platinum"] as const).map((tier) => {
            const price = tier === "Premium" ? row?.premium : row?.platinum;
            return (
              <article key={tier} className={`flex flex-col rounded-2xl border p-4 ${tier === "Platinum" ? "border-amber-300 bg-amber-50/60" : "border-[#0a2540]/10 bg-[#eef4fb]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-primary">{tier}</p>
                  {tier === "Platinum" && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-[#0a2540]">MOST COMPLETE</span>}
                </div>
                <p className="mt-1 text-xs font-semibold text-[#0a2540]/60">{size} · home deep cleaning</p>
                <p className="text-3xl font-extrabold text-[#0a2540]">{price != null ? inr(price) : "On request"}</p>
                <ul className="mt-3 space-y-1.5 text-sm text-[#0a2540]/85">
                  {inclusions[tier].map((i) => <li key={i} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{i}</li>)}
                </ul>
                <button type="button" onClick={() => openLead({ service: "Home Deep Cleaning", pkg: `${size} ${tier}`, price })} className="mt-4 min-h-12 rounded-xl bg-primary text-sm font-bold text-white sm:mt-auto">Book Now</button>
              </article>
            );
          })
        )}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[#0a2540]/60">{note}</p>
    </section>
  );
}

export { LeadModal } from "@/components/public/quick-booking-modal";
