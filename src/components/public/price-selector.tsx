"use client";

import { useState } from "react";
import Link from "next/link";

// One interactive price picker for the festival / home-cleaning landing pages:
// Select BHK → Select package → View price. It replaces the separate festival,
// Premium and Platinum price tables so the page stays short. Prices come from the
// server (pricing master + the active festival window) — never typed here.

export type HomeRow = { bhk: string; premium: number | null; platinum: number | null; premiumHref: string | null; platinumHref: string | null };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const TIERS = ["Premium", "Platinum"] as const;
type Tier = (typeof TIERS)[number];

export function PriceSelector({ rows, note, bookHref = "#quote", heading = "Pick your home size" }: { rows: HomeRow[]; note: string; bookHref?: string; heading?: string }) {
  const [bhk, setBhk] = useState<string>("");
  const [tier, setTier] = useState<Tier | "">("");
  const row = rows.find((r) => r.bhk === bhk);
  const price = row && tier ? (tier === "Premium" ? row.premium : row.platinum) : null;
  const href = row && tier ? (tier === "Premium" ? row.premiumHref : row.platinumHref) : null;
  const chip = (on: boolean) => `min-h-11 flex-1 rounded-xl px-3 text-sm font-bold transition ${on ? "bg-primary text-white shadow" : "bg-white text-[#0a2540] ring-1 ring-[#0a2540]/15"}`;

  return (
    <section id="price-selector" className="scroll-mt-20 rounded-2xl bg-white p-3 shadow-sm sm:p-4">
      <h2 className="text-lg font-bold sm:text-xl">{heading}</h2>

      <p className="mt-2 text-xs font-semibold text-[#0a2540]/60">1 · Select BHK</p>
      <div className="mt-1 flex gap-2" role="group" aria-label="Home size">
        {[...rows.map((r) => r.bhk), "4 BHK+"].map((b) => (
          <button key={b} type="button" aria-pressed={bhk === b} onClick={() => { setBhk(b); if (b === "4 BHK+") setTier(""); }} className={chip(bhk === b)}>
            {b}
          </button>
        ))}
      </div>

      {bhk && bhk !== "4 BHK+" && (
        <>
          <p className="mt-3 text-xs font-semibold text-[#0a2540]/60">2 · Select package</p>
          <div className="mt-1 flex gap-2" role="group" aria-label="Package">
            {TIERS.map((t) => (
              <button key={t} type="button" aria-pressed={tier === t} onClick={() => setTier(t)} className={chip(tier === t)}>
                {t === "Platinum" ? "Platinum ⭐" : t}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 rounded-xl bg-[#eef4fb] p-3" aria-live="polite">
        {!bhk ? (
          <p className="text-sm text-[#0a2540]/70">Select your home size to see the price.</p>
        ) : bhk === "4 BHK+" ? (
          <>
            <p className="text-sm font-bold text-amber-700">Free site inspection, then a quote</p>
            <p className="text-xs text-[#0a2540]/70">Larger homes are priced after we visit.</p>
            <a href={bookHref} className="mt-2 flex min-h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">Book free inspection</a>
          </>
        ) : !tier ? (
          <p className="text-sm text-[#0a2540]/70">Now choose Premium or Platinum.</p>
        ) : price == null ? (
          <p className="text-sm font-bold text-amber-700">Price on confirmation for {bhk} {tier}.</p>
        ) : (
          <>
            <p className="text-xs font-semibold text-[#0a2540]/60">{bhk} · {tier} home deep cleaning</p>
            <p className="text-3xl font-extrabold text-primary">{inr(price)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <a href={bookHref} className="flex min-h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">Book {bhk} {tier}</a>
              <Link href={href ?? "/home-deep-cleaning-pune"} className="flex min-h-11 items-center justify-center rounded-xl border border-primary/40 text-sm font-bold text-primary">What&apos;s included</Link>
            </div>
          </>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[#0a2540]/60">{note}</p>
    </section>
  );
}
