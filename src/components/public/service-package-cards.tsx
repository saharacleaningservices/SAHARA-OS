"use client";

import { CollapsibleList } from "@/components/public/collapsible-list";
import { AnchorPrice } from "@/components/public/anchor-price";
import { useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { openLead } from "@/components/public/bhk-price-cards";

// Visual package cards for the individual-service pages (owner 2026-11-12) — same side-by-side card look as the Full Home
// Premium / Platinum cards, with Included and Not included checklists inside each card and a quantity selector where the
// service is priced per seat / bathroom / window. Prices arrive as props from the live pricing master; nothing is priced
// here. "Book" opens the shared booking flow (fixed price) or the inquiry form (price confirmed before booking).
// Layout model: BOXED card inside the max-w-6xl page; cards stack on phones and sit side by side from md.

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export type PackageCard = {
  id: string;
  title: string;
  badge?: string;
  price: number | null;
  unit?: string;
  minQty: number;
  priceNote?: string;
  qty: boolean;
  included: string[];
  excluded: string[];
  highlight: string[];
};

export function ServicePackageCards({ service, cards, note, heading = "Choose your package" }: { service: string; cards: PackageCard[]; note?: string; heading?: string }) {
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(cards.map((c) => [c.id, Math.max(1, c.minQty)])));
  return (
    <section id="book" aria-labelledby="pkg-title" className="scroll-mt-24 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <h2 id="pkg-title" className="text-xl font-extrabold text-[#0a2540] sm:text-2xl">{heading}</h2>
      <div className={`mt-4 grid gap-3 ${cards.length > 1 ? "md:grid-cols-2" : "md:max-w-xl"}`}>
        {cards.map((c) => {
          const min = Math.max(1, c.minQty);
          const q = qty[c.id] ?? min;
          const total = c.price != null ? c.price * (c.qty ? q : min) : null;
          const featured = !!c.badge;
          const label = c.title.toLowerCase().includes(service.toLowerCase()) ? c.title : `${service} — ${c.title}`;
          return (
            <article key={c.id} className={`flex flex-col rounded-2xl border p-4 ${featured ? "border-amber-300 bg-amber-50/60" : "border-[#0a2540]/10 bg-[#eef4fb]"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-wide text-primary">{c.title}</p>
                  <p className="text-xs font-semibold text-[#0a2540]/60">{c.price != null ? `${inr(c.price)} ${c.unit ?? ""}`.trim() : c.priceNote ?? "Price confirmed before booking"}</p>
                </div>
                {c.badge && <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-[#0a2540]">{c.badge}</span>}
              </div>
              <p className="mt-1 text-3xl font-extrabold text-[#0a2540]">{total != null ? inr(total) : <span className="text-lg">{c.priceNote ?? "Price confirmed before booking"}</span>} <AnchorPrice price={total} /></p>
              {c.qty && c.price != null && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#0a2540]/60">{min > 1 ? `Minimum ${min} ${c.unit?.replace(/^per /, "") ?? ""}`.trim() : "Select quantity"}</p>
                  <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-[#0a2540]/10" role="group" aria-label={`Quantity for ${c.title}`}>
                    <button type="button" aria-label="Decrease" disabled={q <= min} onClick={() => setQty({ ...qty, [c.id]: q - 1 })} className="flex size-9 items-center justify-center rounded-lg disabled:opacity-30"><Minus className="size-4" /></button>
                    <span className="w-8 text-center font-extrabold tabular-nums" aria-live="polite">{q}</span>
                    <button type="button" aria-label="Increase" disabled={q >= 50} onClick={() => setQty({ ...qty, [c.id]: q + 1 })} className="flex size-9 items-center justify-center rounded-lg"><Plus className="size-4" /></button>
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-emerald-700">Included</p>
              <CollapsibleList className="mt-1 space-y-1 text-sm text-[#0a2540]/85">
                {c.included.map((i) => c.highlight.includes(i)
                  ? <li key={i} className="flex gap-1.5 rounded-lg bg-amber-100 px-2 py-1 font-extrabold text-[#0a2540] ring-1 ring-amber-300"><Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />{i}</li>
                  : <li key={i} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{i}</li>)}
              </CollapsibleList>
              <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-red-700">Not included</p>
              <ul className="mt-1 space-y-1 text-sm text-[#0a2540]/70">{c.excluded.map((i) => <li key={i} className="flex gap-1.5"><X className="mt-0.5 size-4 shrink-0 text-red-500" />{i}</li>)}</ul>
              <button
                type="button"
                onClick={() => openLead(total != null
                  ? { service: label, pkg: c.qty ? `${q} × ${c.unit?.replace(/^per /, "") ?? "unit"}` : undefined, price: total, category: "INDIVIDUAL_CLEANING", items: [{ contentId: c.id, qty: c.qty ? q : min }], packageName: c.title }
                  : { service: label })}
                className="mt-4 min-h-12 rounded-xl bg-primary text-sm font-bold text-white md:mt-auto"
              >
                {total != null ? `Book · ${inr(total)}` : "Get Price & Book"}
              </button>
            </article>
          );
        })}
      </div>
      {note && <p className="mt-3 text-[11px] leading-snug text-[#0a2540]/60">{note}</p>}
    </section>
  );
}
