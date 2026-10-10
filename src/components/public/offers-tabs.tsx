"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

// Compact festival landing: one sticky tab bar switches between the four core
// services so the page doesn't grow with every category. Prices are passed in
// from the server (pricing master + active festival window) — never typed here.

export type HomeRow = { bhk: string; premium: number | null; platinum: number | null; premiumHref: string | null; platinumHref: string | null };
export type CategoryCard = { key: string; label: string; title: string; text: string; cta: string; href: string; img: string };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function OffersTabs({ home, priceNote, homeCta, categories }: { home: HomeRow[]; priceNote: string; homeCta: string; categories: CategoryCard[] }) {
  const tabs = [{ key: "home", label: "Home Deep Cleaning" }, ...categories.map((c) => ({ key: c.key, label: c.label }))];
  const [active, setActive] = useState("home");
  const card = categories.find((c) => c.key === active);

  return (
    <section id="services" className="scroll-mt-16">
      <div role="tablist" aria-label="Services" className="sticky top-[57px] z-30 -mx-4 flex gap-1.5 overflow-x-auto bg-[#eef4fb]/95 px-4 py-2 backdrop-blur [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${active === t.key ? "bg-primary text-white shadow" : "bg-white text-[#0a2540] shadow-sm"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "home" ? (
        <div role="tabpanel" className="mt-2 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_1fr_1fr] bg-[#0a2540] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white">
            <span>Size</span>
            <span>Premium</span>
            <span>Platinum ⭐</span>
          </div>
          {home.map((r) => (
            <div key={r.bhk} className="grid grid-cols-[1fr_1fr_1fr] items-center border-t border-[#0a2540]/10 px-3 py-2 text-sm">
              <span className="font-bold">{r.bhk}</span>
              {[{ v: r.premium, href: r.premiumHref }, { v: r.platinum, href: r.platinumHref }].map((c, i) =>
                c.v == null ? (
                  <span key={i} className="text-xs text-[#0a2540]/50">—</span>
                ) : c.href ? (
                  <Link key={i} href={c.href} className="font-extrabold text-primary underline-offset-2 hover:underline">{inr(c.v)}</Link>
                ) : (
                  <span key={i} className="font-extrabold text-primary">{inr(c.v)}</span>
                ),
              )}
            </div>
          ))}
          <div className="border-t border-[#0a2540]/10 px-3 py-2 text-sm">
            <span className="font-bold">4 BHK+</span> — <span className="font-semibold text-amber-700">Free site inspection, then quote</span>
          </div>
          <p className="border-t border-[#0a2540]/10 px-3 py-2 text-[11px] leading-snug text-[#0a2540]/65">{priceNote}</p>
          <div className="grid grid-cols-2 gap-2 border-t border-[#0a2540]/10 p-3">
            <a href="#quote" className="flex min-h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">{homeCta}</a>
            <Link href="/home-deep-cleaning-pune" className="flex min-h-11 items-center justify-center rounded-xl border border-primary/40 text-sm font-bold text-primary">What&apos;s included</Link>
          </div>
        </div>
      ) : card ? (
        <div role="tabpanel" className="mt-2 flex gap-3 rounded-2xl bg-white p-3 shadow-sm">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-xl">
            <Image src={card.img} alt={card.title} fill sizes="96px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold leading-tight">{card.title}</h3>
            <p className="mt-0.5 text-xs leading-snug text-[#0a2540]/70">{card.text}</p>
            <Link href={card.href} className="mt-2 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-xs font-bold text-white">{card.cta} →</Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
