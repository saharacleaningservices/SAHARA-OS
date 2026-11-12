"use client";

import { useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { openLead } from "@/components/public/bhk-price-cards";

// Interactive rate calculators for the /services/<slug> landing pages (owner R&D directive 2026-11-02). Prices arrive as props
// from the server (live pricing master / PEST_BHK_RATES) — nothing is priced here. Every "Book" opens the shared quick-booking
// modal: fixed-rate → "Confirm Your Booking", inspection → "Request Inspection / Submit Inquiry".
// Layout model: BOXED card inside the max-w-6xl page; options stack on phones and sit side by side from sm.

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const chip = (on: boolean) => `min-h-11 whitespace-nowrap rounded-xl px-3 text-sm font-bold transition ${on ? "bg-primary text-white shadow" : "bg-white text-[#0a2540] ring-1 ring-[#0a2540]/15 hover:ring-primary"}`;

export type TierScope = { included: string[]; excluded: string[]; /** Included lines to show bold + highlighted (the tier's differentiator). */ highlight?: string[] };
export type HomeRow = { bhk: string; premium: number | null; platinum: number | null; premiumId?: string; platinumId?: string };
type PropType = "1 BHK" | "2 BHK" | "3 BHK" | "4 BHK+" | "Bungalow / Villa";
const TYPES: PropType[] = ["1 BHK", "2 BHK", "3 BHK", "4 BHK+", "Bungalow / Villa"];

/**
 * Full House package calculator: property type (1/2/3/4 BHK+, Bungalow/Villa) × occasion (Regular, Move-in / Move-out,
 * Post-Construction) → Premium and Platinum tiers with What's included / excluded. 1–3 BHK carry fixed rates; 4 BHK+, villas and
 * post-construction keep the owner's policy of a price after a free site inspection, with the same tier scope shown.
 */
// Occasion tabs (owner 2026-11-03): Regular · Unfurnished (fixed 1/2/3 BHK rates) · Post-Interior Cleaning (free inspection).
export const OCCASIONS = ["Regular", "Unfurnished", "Post-Interior Cleaning"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export function PackageCalculator({ service, rows, scope, note, defaultOccasion = "Regular", unfurnished = [], unfurnishedScope }: { service: string; rows: HomeRow[]; scope: { Premium: TierScope; Platinum: TierScope }; note: string; defaultOccasion?: Occasion; unfurnished?: UnfurnishedRow[]; unfurnishedScope?: TierScope }) {
  const [type, setType] = useState<PropType>("2 BHK");
  const [occasion, setOccasion] = useState<Occasion>(defaultOccasion);
  const row = rows.find((r) => r.bhk === type);
  const inspection = occasion === "Post-Interior Cleaning" || !row;
  const uf = unfurnished.find((r) => r.bhk === type);
  const label = occasion === "Regular" ? service : `${service} · ${occasion}`;
  return (
    <section id="book" aria-labelledby="calc-title" className="scroll-mt-24 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <h2 id="calc-title" className="text-xl font-extrabold text-[#0a2540] sm:text-2xl">Choose your package</h2>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#0a2540]/55">Property</p>
      <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Property type">
        {TYPES.map((t) => <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={chip(type === t)}>{t}</button>)}
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#0a2540]/55">Occasion</p>
      <div className="mt-1.5 flex flex-wrap gap-2 pb-1" role="group" aria-label="Occasion">
        {OCCASIONS.map((o) => <button key={o} type="button" aria-pressed={occasion === o} onClick={() => setOccasion(o)} className={chip(occasion === o)}>{o}</button>)}
      </div>

      {occasion === "Unfurnished" ? (
        <div className="mt-4" aria-live="polite">
          <article className="flex flex-col rounded-2xl border border-[#0a2540]/10 bg-[#eef4fb] p-4">
            <p className="text-sm font-extrabold uppercase tracking-wide text-primary">Unfurnished</p>
            <p className="text-xs font-semibold text-[#0a2540]/60">{type} · empty flat, no furniture</p>
            <p className="mt-1 text-3xl font-extrabold text-[#0a2540]">{uf ? inr(uf.price) : <span className="text-lg">Price after free site inspection</span>}</p>
            {unfurnishedScope && (
              <>
                <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-emerald-700">Included</p>
                <ul className="mt-1 space-y-1 text-sm text-[#0a2540]/85">{unfurnishedScope.included.map((i) => <li key={i} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{i}</li>)}</ul>
                <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-red-700">Not included</p>
                <ul className="mt-1 space-y-1 text-sm text-[#0a2540]/70">{unfurnishedScope.excluded.map((i) => <li key={i} className="flex gap-1.5"><X className="mt-0.5 size-4 shrink-0 text-red-500" />{i}</li>)}</ul>
              </>
            )}
            <button type="button" onClick={() => openLead(uf ? { service: "Unfurnished Home Cleaning", pkg: `${type} Unfurnished`, price: uf.price, category: "HOME_DEEP_CLEANING", items: [{ contentId: uf.id, qty: 1 }], propertyType: type, packageName: "Unfurnished Deep Cleaning" } : { service: "Unfurnished Home Cleaning", pkg: type, inspection: true })} className="mt-4 min-h-12 rounded-xl bg-primary text-sm font-bold text-white">{uf ? `Book Unfurnished · ${inr(uf.price)}` : "Book Free Inspection"}</button>
          </article>
        </div>
      ) : (
      <div className="mt-4 grid gap-3 md:grid-cols-2" aria-live="polite">
        {(["Premium", "Platinum"] as const).map((tier) => {
          const price = inspection ? null : tier === "Premium" ? row?.premium ?? null : row?.platinum ?? null;
          return (
            <article key={tier} className={`flex flex-col rounded-2xl border p-4 ${tier === "Platinum" ? "border-amber-300 bg-amber-50/60" : "border-[#0a2540]/10 bg-[#eef4fb]"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-wide text-primary">{tier}</p>
                  <p className="text-xs font-semibold text-[#0a2540]/60">{type} · {occasion === "Regular" ? "deep cleaning" : occasion}</p>
                </div>
                {tier === "Platinum" && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-[#0a2540]">MOST COMPLETE</span>}
              </div>
              <p className="mt-1 text-3xl font-extrabold text-[#0a2540]">{price != null ? inr(price) : <span className="text-lg">Price after free site inspection</span>}</p>
              <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-emerald-700">Included</p>
              <ul className="mt-1 space-y-1 text-sm text-[#0a2540]/85">{scope[tier].included.map((i) => scope[tier].highlight?.includes(i) ? <li key={i} className="flex gap-1.5 rounded-lg bg-amber-100 px-2 py-1 font-extrabold text-[#0a2540] ring-1 ring-amber-300"><Check className="mt-0.5 size-4 shrink-0 text-emerald-700" />{i}</li> : <li key={i} className="flex gap-1.5"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{i}</li>)}</ul>
              <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-red-700">Not included</p>
              <ul className="mt-1 space-y-1 text-sm text-[#0a2540]/70">{scope[tier].excluded.map((i) => <li key={i} className="flex gap-1.5"><X className="mt-0.5 size-4 shrink-0 text-red-500" />{i}</li>)}</ul>
              <button type="button" onClick={() => { const id = tier === "Premium" ? row?.premiumId : row?.platinumId; openLead(price != null && id ? { service: label, pkg: `${type} ${tier}`, price, category: "HOME_DEEP_CLEANING", items: [{ contentId: id, qty: 1 }], propertyType: type, packageName: `${tier}${occasion === "Regular" ? "" : ` · ${occasion}`}` } : { service: label, pkg: `${type} ${tier}`, inspection: true }); }} className="mt-4 min-h-12 rounded-xl bg-primary text-sm font-bold text-white md:mt-auto">{price != null ? `Book ${tier} · ${inr(price)}` : "Book Free Inspection"}</button>
            </article>
          );
        })}
      </div>
      )}
      <p className="mt-3 text-[11px] leading-snug text-[#0a2540]/60">{note}</p>
    </section>
  );
}

export type QtyItem = { id: string; name: string; price: number | null; unit?: string; minQty?: number; rule?: string; priceNote?: string };

/** Quantity calculator for per-unit services (sofa seats, bathrooms, windows…): stepper × rate = live total. */
export function QtyCalculator({ service, items, note, heading = "Calculate your price" }: { service: string; items: QtyItem[]; note: string; heading?: string }) {
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.id, Math.max(1, i.minQty ?? 1)])));
  return (
    <section id="book" aria-labelledby="qty-title" className="scroll-mt-24 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <h2 id="qty-title" className="text-xl font-extrabold text-[#0a2540] sm:text-2xl">{heading}</h2>
      <ul className="mt-3 space-y-3">
        {items.map((i) => {
          const min = Math.max(1, i.minQty ?? 1);
          const q = qty[i.id] ?? min;
          const total = i.price != null ? i.price * q : null;
          return (
            <li key={i.id} className="rounded-2xl bg-[#eef4fb] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-extrabold text-[#0a2540]">{i.name}</p>
                  <p className="text-sm text-[#0a2540]/70">{i.price != null ? <>{inr(i.price)} {i.unit}</> : i.priceNote ?? "Price confirmed before booking"}</p>
                  {i.rule && <p className="text-[11px] text-[#0a2540]/55">{i.rule}</p>}
                </div>
                {i.unit && i.price != null && (
                  <div className="flex items-center gap-1 rounded-xl bg-white p-1 ring-1 ring-[#0a2540]/10" role="group" aria-label={`Quantity for ${i.name}`}>
                    <button type="button" aria-label="Decrease" disabled={q <= min} onClick={() => setQty({ ...qty, [i.id]: q - 1 })} className="flex size-9 items-center justify-center rounded-lg disabled:opacity-30"><Minus className="size-4" /></button>
                    <span className="w-8 text-center font-extrabold tabular-nums" aria-live="polite">{q}</span>
                    <button type="button" aria-label="Increase" disabled={q >= 50} onClick={() => setQty({ ...qty, [i.id]: q + 1 })} className="flex size-9 items-center justify-center rounded-lg"><Plus className="size-4" /></button>
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-2xl font-extrabold text-[#0a2540]">{total != null ? inr(total) : ""}</p>
                <button type="button" onClick={() => openLead(total != null ? { service: i.name.startsWith(service) ? i.name : `${service} — ${i.name}`, pkg: i.unit ? `${q} × ${i.unit.replace(/^per /, "")}` : undefined, price: total, category: "INDIVIDUAL_CLEANING", items: [{ contentId: i.id, qty: q }], packageName: i.name } : { service: i.name.startsWith(service) ? i.name : `${service} — ${i.name}` })} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-white">Book Now</button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-snug text-[#0a2540]/60">{note}</p>
    </section>
  );
}

export type PestRow = { name: string; note: string; rates: Record<string, number>; image: string };

/**
 * Pest control (owner 2026-11-02): visual treatment cards first; tapping one reveals its flat 1–4 BHK rates and Book button.
 * Villas / commercial premises go to a free inspection.
 */
export function PestCalculator({ rows, sizes, note }: { rows: PestRow[]; sizes: readonly string[]; note: string }) {
  const [pick, setPick] = useState<string | null>(null);
  const [size, setSize] = useState<string>(sizes[1] ?? sizes[0]);
  const row = rows.find((r) => r.name === pick);
  return (
    <section id="book" aria-labelledby="pest-title" className="scroll-mt-24 rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <h2 id="pest-title" className="text-xl font-extrabold text-[#0a2540] sm:text-2xl">Choose a treatment</h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {rows.map((r) => {
          const on = r.name === pick;
          return (
            <li key={r.name}>
              <button type="button" aria-pressed={on} onClick={() => setPick(on ? null : r.name)} className={`group flex h-full w-full flex-col overflow-hidden rounded-2xl text-left ring-2 transition ${on ? "ring-primary shadow-lg" : "ring-transparent bg-[#eef4fb] hover:ring-primary/40"}`}>
                <span className="relative block aspect-[4/3] w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image} alt={r.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                </span>
                <span className={`flex flex-1 flex-col p-3 ${on ? "bg-primary text-white" : ""}`}>
                  <span className="text-sm font-extrabold leading-snug">{r.name}</span>
                  <span className={`mt-1 text-xs font-bold ${on ? "text-white/85" : "text-primary"}`}>{on ? "Selected ✓" : "View rates"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {row && (
        <div className="mt-4 rounded-2xl bg-[#eef4fb] p-4" aria-live="polite">
          <p className="font-extrabold text-[#0a2540]">{row.name}</p>
          <p className="text-xs text-[#0a2540]/65">{row.note}</p>
          <div className="mt-3 flex gap-2" role="group" aria-label="Home size">
            {sizes.map((s) => <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={`${chip(size === s)} flex-1`}>{s}</button>)}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-3xl font-extrabold text-[#0a2540]">{inr(row.rates[size])}<span className="ml-1 text-xs font-semibold text-[#0a2540]/55">{size}</span></p>
            <button type="button" onClick={() => openLead({ service: `Pest Control — ${row.name}`, pkg: size, price: row.rates[size], category: "PEST_CONTROL", propertyType: size, packageName: row.name })} className="min-h-12 rounded-xl bg-primary px-6 text-sm font-bold text-white">Book Now</button>
          </div>
        </div>
      )}
      <button type="button" onClick={() => openLead({ service: "Pest Control", pkg: "Villa / bungalow / commercial", inspection: true })} className="mt-3 w-full rounded-xl border-2 border-dashed border-primary/40 py-3 text-sm font-bold text-primary">Villa, bungalow or commercial premises? Book a free inspection</button>
      <p className="mt-3 text-[11px] leading-snug text-[#0a2540]/60">{note}</p>
    </section>
  );
}

export type UnfurnishedRow = { bhk: string; price: number; id: string };

/**
 * Unfurnished flat deep cleaning (owner benchmark rates 2026-11-02): 1 / 2 / 3 BHK fixed prices, 4 BHK+ on free inspection.
 * Booking goes through the same quick-booking modal (HOME_DEEP_CLEANING, server re-priced from the item id).
 */
export function UnfurnishedCalculator({ rows }: { rows: UnfurnishedRow[] }) {
  return (
    <section aria-labelledby="uf-title" className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
      <h2 id="uf-title" className="text-xl font-extrabold text-[#0a2540] sm:text-2xl">Unfurnished flat rates</h2>
      <p className="mt-1 text-sm text-[#0a2540]/70">Empty flats only — every surface reachable, so it costs less than a furnished deep clean.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col rounded-2xl bg-[#f5f8fd] p-4 ring-1 ring-[#0a2540]/10">
            <p className="text-sm font-bold text-[#0a2540]/70">{r.bhk} Unfurnished</p>
            <p className="mt-1 text-2xl font-extrabold text-[#0a2540]">{inr(r.price)}</p>
            <button type="button" onClick={() => openLead({ service: "Unfurnished Home Cleaning", pkg: `${r.bhk} Unfurnished`, price: r.price, category: "HOME_DEEP_CLEANING", items: [{ contentId: r.id, qty: 1 }], propertyType: r.bhk, packageName: "Unfurnished Deep Cleaning" })} className="mt-3 min-h-12 rounded-xl bg-primary text-sm font-bold text-white">
              Book {r.bhk} · {inr(r.price)}
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => openLead({ service: "Unfurnished Home Cleaning", pkg: "4 BHK+ / Villa", inspection: true })} className="mt-3 text-sm font-bold text-primary">4 BHK or larger? Book a free site inspection →</button>
    </section>
  );
}
