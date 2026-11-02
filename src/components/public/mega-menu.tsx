import Link from "next/link";
import { ArrowRight, BadgeCheck, ChevronDown, Menu, MessageCircle, Phone, Star } from "lucide-react";
import { NAV_MEGA } from "@/config/nav-menu";
import { BRANCHES } from "@/config/pune-seo-matrix";
import { COMPANY } from "@/lib/constants";
import { TRUST } from "@/lib/booking-target";
import { waLink } from "@/lib/marketing-content";
import { LeadButton } from "@/components/public/lead-button";

/**
 * Public header (owner rebuild 2026-11-02). Server component, no JavaScript:
 *   top strip  — both branches (Magarpatta: call 7083347130 · WhatsApp 9175220270; Mohammadwadi: 8956567130 / 7083347130),
 *                GSTIN and Google rating badges,
 *   main bar   — logo, 4-category mega dropdown (Residential · Individual · Commercial B2B · Relocation & Property),
 *                pulsing "Call Now" and "WhatsApp Us" buttons, Book Now,
 *   mobile     — a hamburger <details> panel listing all four categories flat (no nested accordions).
 * Layout model: BOXED (max-w-6xl) — dropdown panels align with the page columns on every screen.
 */
const fmt = (n: string) => `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
const MAG = BRANCHES.magarpatta;
const MOH = BRANCHES.mohammadwadi;
const WA_TEXT = "Hi Sahara, I'd like a quote for a service in Pune.";

export function MegaMenuHeader({ logo }: { logo?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 shadow-sm backdrop-blur">
      {/* Branch strip */}
      <div className="bg-[#0a2540] text-[12px] text-white/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5">
          <p className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-0.5">
            <span className="whitespace-nowrap"><span className="font-bold text-amber-300">Magarpatta:</span> <a href={`tel:+91${MAG.phone}`} className="font-semibold text-white hover:text-amber-300">{fmt(MAG.phone)}</a> · <a href={waLink(WA_TEXT, MAG.whatsapp)} target="_blank" rel="noreferrer" className="hover:text-amber-300">WhatsApp {fmt(MAG.whatsapp)}</a></span>
            <span className="hidden whitespace-nowrap md:inline"><span className="font-bold text-amber-300">Mohammadwadi:</span> <a href={`tel:+91${MOH.phone}`} className="font-semibold text-white hover:text-amber-300">{fmt(MOH.phone)}</a> / {MOH.altPhones.map((p) => <a key={p} href={`tel:+91${p}`} className="font-semibold text-white hover:text-amber-300">{fmt(p)}</a>)}</span>
          </p>
          <p className="hidden shrink-0 items-center gap-2 lg:flex">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><Star className="size-3 fill-amber-300 text-amber-300" aria-hidden />{TRUST.rating}★ Google · {TRUST.siteReviewLabel} reviews</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5"><BadgeCheck className="size-3 text-emerald-300" aria-hidden />GSTIN {COMPANY.gstin}</span>
          </p>
        </div>
      </div>

      <div className="relative border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/" aria-label="Sahara Cleaning Services — home" className="shrink-0">{logo ?? <span className="text-base font-extrabold text-[#0a2540]">Sahara Cleaning</span>}</Link>

          <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
            {NAV_MEGA.map((m) => (
              <div key={m.id} className="group static">
                <button type="button" aria-haspopup="true" className="flex items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-bold text-[#0a2540] hover:bg-primary/10 focus-visible:bg-primary/10 group-hover:bg-primary/10">
                  {m.short} <ChevronDown className="size-4 transition group-focus-within:rotate-180 group-hover:rotate-180" aria-hidden />
                </button>
                <div className="invisible absolute inset-x-0 top-full border-b border-border bg-white opacity-0 shadow-xl transition duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-6 px-4 py-6">
                    <div className="rounded-2xl bg-[#0a2540] p-5 text-white">
                      <p className="text-lg font-extrabold">{m.label}</p>
                      <p className="mt-1 text-sm text-white/75">{m.blurb}</p>
                      <LeadButton intent={{ service: m.label }} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-amber-300">{m.id === "commercial" || m.id === "relocation" ? "Request site inspection" : "Book now"} <ArrowRight className="size-4" /></LeadButton>
                    </div>
                    <ul className="grid grid-cols-3 gap-2">
                      {m.items.map((i) => (
                        <li key={i.href}>
                          <Link href={i.href} className="flex h-full flex-col rounded-2xl bg-[#eef4fb] p-3.5 hover:ring-2 hover:ring-primary">
                            <span className="text-sm font-extrabold leading-snug text-[#0a2540]">{i.label}</span>
                            <span className="mt-0.5 text-xs text-[#0a2540]/65">{i.blurb}</span>
                            <span className={`mt-2 w-fit rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${i.pricing === "inspection" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{i.pricing === "inspection" ? "On inspection" : i.pricing === "bhk" ? "Fixed BHK rates" : "Fixed rates"}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
            <Link href="/gallery" className="whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-bold text-[#0a2540] hover:bg-primary/10">Our Work</Link>
            <Link href="/contact" className="rounded-xl px-2.5 py-2 text-[13px] font-bold text-[#0a2540] hover:bg-primary/10">Contact</Link>
          </nav>

          <div className="flex items-center gap-2">
            <a href={`tel:+91${MAG.phone}`} aria-label={`Call Now ${MAG.phone}`} className="sahara-wave-call hidden min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 text-xs font-bold text-white sm:flex"><Phone className="size-3.5" /> Call Now</a>
            <a href={waLink(WA_TEXT, MAG.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp Us" className="sahara-wave-wa flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#25D366] px-3 text-xs font-bold text-white"><MessageCircle className="size-4" /><span className="hidden sm:inline">WhatsApp Us</span></a>
            <LeadButton intent={{ service: "General enquiry" }} className="hidden min-h-10 items-center whitespace-nowrap rounded-xl bg-amber-400 px-3 text-xs font-extrabold text-[#0a2540] md:flex">Book Now</LeadButton>
            <details className="group relative xl:hidden">
              <summary aria-label="Open menu" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl border border-border text-[#0a2540] [&::-webkit-details-marker]:hidden"><Menu className="size-5" /></summary>
              <div className="fixed inset-x-0 top-[92px] max-h-[calc(100vh-92px)] overflow-y-auto border-b border-border bg-white p-3 shadow-xl">
                {NAV_MEGA.map((m) => (
                  <section key={m.id} className="rounded-xl border border-border bg-[#eef4fb] px-4 py-3 [&+section]:mt-2">
                    <p className="text-sm font-extrabold text-[#0a2540]">{m.label}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {m.items.map((i) => <li key={i.href}><Link href={i.href} className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-xs font-semibold text-[#0a2540]/85 ring-1 ring-border">{i.label}</Link></li>)}
                    </ul>
                  </section>
                ))}
                <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm font-bold">
                  <a href={`tel:+91${MAG.phone}`} className="rounded-xl bg-primary py-3 text-white">Call Magarpatta</a>
                  <a href={`tel:+91${MOH.phone}`} className="rounded-xl bg-primary py-3 text-white">Call Mohammadwadi</a>
                  <Link href="/gallery" className="rounded-xl border border-border py-3 text-[#0a2540]">Our Work</Link>
                  <Link href="/contact" className="rounded-xl border border-border py-3 text-[#0a2540]">Contact</Link>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
