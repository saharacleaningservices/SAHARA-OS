"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, X } from "lucide-react";
import { openLead, type LeadIntent } from "@/components/public/bhk-price-cards";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export type DrillRow = { bhk: string; premium: number | null; platinum: number | null };
export type DrillRate = { name: string; price: number | null; unit?: string; rule?: string; href?: string };
type Sheet = "home" | "individual" | "pest" | null;

/**
 * Homepage "4 main visual cards" with UrbanCompany-style drill-down (owner 2026-11-02). No prices on the front view; tapping a card
 * opens a bottom sheet:
 *   Full House Deep Cleaning → 1/2/3/4 BHK, Bungalow/Villa, Move-in/Move-out, Post-Construction → (1–3 BHK) Premium / Platinum rates,
 *   Individual Services      → fixed rate cards,
 *   Interior Painting        → straight to the site-inspection lead form,
 *   Pest Control             → flat starting rates per treatment.
 * Every "Book" hands over to the one lead modal (LandingShell), which labels fixed-price bookings "Confirm Your Booking" and
 * inspection jobs "Request Inspection / Submit Inquiry".
 */
export function HomeServiceDrill({ rows, individual, pest, inclusions }: { rows: DrillRow[]; individual: DrillRate[]; pest: DrillRate[]; inclusions: { Premium: string[]; Platinum: string[] } }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const [homeStep, setHomeStep] = useState<{ service: string; bhk: string } | null>(null);

  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [sheet]);

  function close() { setSheet(null); setHomeStep(null); }
  function book(intent: LeadIntent) { close(); setTimeout(() => openLead(intent), 60); }

  const cards = [
    { key: "home" as const, title: "Full House Deep Cleaning", sub: "1–4 BHK, villas, move-in/out, post-construction", img: "/marketing/hero-home.webp", alt: "Sahara technician deep cleaning a Pune apartment" },
    { key: "individual" as const, title: "Individual Services", sub: "Kitchen, bathroom, sofa, carpet, windows", img: "/marketing/carousel-equipment.webp", alt: "Sahara technician shampooing a sofa" },
    { key: "painting" as const, title: "Interior Painting", sub: "Free site inspection & written quote", img: "/marketing/service-painting.webp", alt: "Sahara painters rolling a living-room wall" },
    { key: "pest" as const, title: "Pest Control", sub: "Cockroach, bed bug, rodent, termite, mosquito", img: "/marketing/service-pest-control.webp", alt: "Sahara pest control technician treating a kitchen" },
  ];

  const row = homeStep ? rows.find((r) => r.bhk === homeStep.bhk) : undefined;
  const title = sheet === "home" ? (homeStep ? `${homeStep.service} · ${homeStep.bhk}` : "Full House Deep Cleaning") : sheet === "individual" ? "Individual Services" : "Pest Control";

  return (
    <section id="services" aria-labelledby="svc-title" className="scroll-mt-20">
      <h2 id="svc-title" className="text-2xl font-extrabold text-[#0a2540] sm:text-3xl">Our services</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => (c.key === "painting" ? openLead({ service: "Interior Painting", inspection: true }) : setSheet(c.key))}
            className="group flex flex-col overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-[#0a2540]/5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="relative block aspect-[4/3] w-full">
              <Image src={c.img} alt={c.alt} fill sizes="(min-width:1024px) 25vw, 50vw" loading="lazy" className="object-cover transition duration-500 group-hover:scale-105" />
            </span>
            <span className="flex flex-1 flex-col p-3 sm:p-4">
              <span className="text-[15px] font-extrabold leading-snug text-[#0a2540] sm:text-lg">{c.title}</span>
              <span className="mt-0.5 hidden text-xs text-[#0a2540]/65 sm:block sm:text-sm">{c.sub}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-bold text-primary">{c.key === "painting" ? "Book inspection" : "View options"}<ChevronRight className="size-4 transition group-hover:translate-x-0.5" /></span>
            </span>
          </button>
        ))}
      </div>

      {sheet && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-[#0a2540]/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 text-[#0a2540] shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              {homeStep ? <button type="button" onClick={() => setHomeStep(null)} aria-label="Back" className="flex size-10 items-center justify-center rounded-full bg-[#eef4fb]"><ArrowLeft className="size-5" /></button> : <span className="size-10" />}
              <h3 id="sheet-title" className="flex-1 text-center text-lg font-extrabold">{title}</h3>
              <button type="button" onClick={close} aria-label="Close" className="flex size-10 items-center justify-center rounded-full bg-[#eef4fb]"><X className="size-5" /></button>
            </div>

            {sheet === "home" && !homeStep && (
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {["1 BHK", "2 BHK", "3 BHK"].map((b) => <li key={b}><button type="button" onClick={() => setHomeStep({ service: "Full House Deep Cleaning", bhk: b })} className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-[#eef4fb] px-4 text-sm font-extrabold hover:ring-2 hover:ring-primary">{b}<ArrowRight className="size-4 text-primary" /></button></li>)}
                <li><button type="button" onClick={() => book({ service: "Full House Deep Cleaning", pkg: "4 BHK", inspection: true })} className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-[#eef4fb] px-4 text-sm font-extrabold hover:ring-2 hover:ring-primary">4 BHK<ArrowRight className="size-4 text-primary" /></button></li>
                <li><button type="button" onClick={() => book({ service: "Full House Deep Cleaning", pkg: "Bungalow / Villa", inspection: true })} className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-[#eef4fb] px-4 text-sm font-extrabold hover:ring-2 hover:ring-primary">Bungalow / Villa<ArrowRight className="size-4 text-primary" /></button></li>
                <li><button type="button" onClick={() => setHomeStep({ service: "Move-in / Move-out Cleaning", bhk: "2 BHK" })} className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-[#eef4fb] px-4 text-sm font-extrabold hover:ring-2 hover:ring-primary">Move-in / Move-out<ArrowRight className="size-4 text-primary" /></button></li>
                <li className="col-span-2"><button type="button" onClick={() => book({ service: "Post-Construction Cleaning", inspection: true })} className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-[#eef4fb] px-4 text-sm font-extrabold hover:ring-2 hover:ring-primary">Post-Construction<ArrowRight className="size-4 text-primary" /></button></li>
                <li className="col-span-2 text-center text-xs text-[#0a2540]/60">4 BHK, villas and post-construction are priced after a free site inspection.</li>
              </ul>
            )}

            {sheet === "home" && homeStep && (
              <div className="mt-4">
                <div className="flex gap-2" role="group" aria-label="Home size">
                  {["1 BHK", "2 BHK", "3 BHK"].map((b) => <button key={b} type="button" aria-pressed={homeStep.bhk === b} onClick={() => setHomeStep({ ...homeStep, bhk: b })} className={`min-h-11 flex-1 rounded-xl text-sm font-bold ${homeStep.bhk === b ? "bg-primary text-white" : "bg-white ring-1 ring-[#0a2540]/15"}`}>{b}</button>)}
                </div>
                <div className="mt-3 grid gap-3">
                  {(["Premium", "Platinum"] as const).map((tier) => {
                    const price = tier === "Premium" ? row?.premium : row?.platinum;
                    return (
                      <article key={tier} className={`rounded-2xl border p-4 ${tier === "Platinum" ? "border-amber-300 bg-amber-50/60" : "border-[#0a2540]/10 bg-[#eef4fb]"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-extrabold uppercase tracking-wide text-primary">{tier}</p>
                            <p className="text-2xl font-extrabold">{price != null ? inr(price) : "On request"}</p>
                          </div>
                          <button type="button" onClick={() => book({ service: homeStep.service, pkg: `${homeStep.bhk} ${tier}`, price })} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-white">Book</button>
                        </div>
                        <ul className="mt-2 space-y-1 text-xs text-[#0a2540]/80">{inclusions[tier].slice(0, 4).map((x) => <li key={x} className="flex gap-1.5"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />{x}</li>)}</ul>
                      </article>
                    );
                  })}
                </div>
                <p className="mt-2 text-center text-[11px] text-[#0a2540]/60">Platinum adds wall wet cleaning. Larger homes: <button type="button" onClick={() => book({ service: homeStep.service, pkg: "4 BHK+ / Villa", inspection: true })} className="font-bold text-primary underline">book a free inspection</button>.</p>
              </div>
            )}

            {sheet === "individual" && <RateList rates={individual} service="Individual Services" onBook={book} />}
            {sheet === "pest" && (
              <>
                <RateList rates={pest} service="Pest Control" onBook={book} from />
                <p className="mt-2 text-center text-[11px] text-[#0a2540]/60">Flat starting rates for 1–4 BHK homes; the exact rate for your home size is confirmed on the booking call.</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function RateList({ rates, service, onBook, from }: { rates: DrillRate[]; service: string; onBook: (i: LeadIntent) => void; from?: boolean }) {
  return (
    <ul className="mt-4 space-y-2">
      {rates.map((r) => (
        <li key={r.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[#eef4fb] p-3.5">
          <div className="min-w-0">
            {r.href ? <Link href={r.href} className="font-extrabold hover:text-primary">{r.name}</Link> : <p className="font-extrabold">{r.name}</p>}
            <p className="text-lg font-extrabold">{r.price != null ? <>{from && <span className="mr-1 text-xs font-semibold text-[#0a2540]/60">from</span>}{inr(r.price)}{r.unit && <span className="ml-1 text-xs font-semibold text-[#0a2540]/60">{r.unit}</span>}</> : <span className="text-sm">Price confirmed on call</span>}</p>
            {r.rule && <p className="text-[11px] text-[#0a2540]/60">{r.rule}</p>}
          </div>
          <button type="button" onClick={() => onBook({ service: r.name.includes(service) ? r.name : `${service} — ${r.name}`, price: r.price })} className="min-h-11 shrink-0 rounded-xl bg-primary px-5 text-sm font-bold text-white">Book</button>
        </li>
      ))}
    </ul>
  );
}
