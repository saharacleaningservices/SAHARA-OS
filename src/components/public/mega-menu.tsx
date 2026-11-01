import Link from "next/link";
import { ChevronDown, Menu, Phone } from "lucide-react";
import { NAV_MEGA } from "@/config/nav-menu";
import { CONTACT } from "@/lib/marketing-content";

/**
 * Public header with the Residential / Commercial mega-menus (owner 2026-11-01). Server component, no JavaScript:
 *   desktop (lg+) — hover or keyboard focus opens a full-width panel of pillars; each pillar is a card with its short list,
 *   mobile — a hamburger <details> opens one flat panel (both menus fully listed, no nested accordions), so it works without scripts and stays light.
 * Layout model: BOXED — panels use max-w-6xl so columns line up on every screen.
 */
export function MegaMenuHeader({ logo, bookHref = "/booking" }: { logo?: React.ReactNode; bookHref?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <Link href="/" aria-label="Sahara Cleaning Services — home" className="shrink-0">{logo ?? <span className="text-base font-extrabold text-[#0a2540]">Sahara Cleaning</span>}</Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_MEGA.map((m) => (
            <div key={m.id} className="group static">
              <button type="button" aria-haspopup="true" className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-[#0a2540] hover:bg-primary/10 focus-visible:bg-primary/10 group-hover:bg-primary/10">
                {m.label} <ChevronDown className="size-4 transition group-hover:rotate-180 group-focus-within:rotate-180" aria-hidden />
              </button>
              <div className="invisible absolute inset-x-0 top-full border-b border-border bg-white opacity-0 shadow-xl transition duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className={`mx-auto grid max-w-6xl gap-4 px-4 py-6 ${m.pillars.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
                  {m.pillars.map((p) => (
                    <section key={p.title} className="rounded-2xl bg-[#eef4fb] p-4">
                      <Link href={p.href} className="block text-sm font-extrabold leading-snug text-[#0a2540] hover:text-primary">{p.title}</Link>
                      <p className="mt-0.5 text-xs text-[#0a2540]/60">{p.blurb}</p>
                      <ul className="mt-3 space-y-1.5">
                        {p.items.map((i) => (
                          <li key={`${p.title}-${i.label}`}><Link href={i.href} className="block rounded-lg px-1 py-0.5 text-[13px] leading-snug text-[#0a2540]/85 hover:bg-white hover:text-primary">{i.label}</Link></li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <Link href="/offers" className="rounded-xl px-3 py-2 text-sm font-bold text-[#0a2540] hover:bg-primary/10">Offers</Link>
          <Link href="/contact" className="rounded-xl px-3 py-2 text-sm font-bold text-[#0a2540] hover:bg-primary/10">Contact</Link>
        </nav>

        <div className="flex items-center gap-2">
          <a href={`tel:+91${CONTACT.call[0]}`} aria-label={`Call ${CONTACT.call[0]}`} className="hidden items-center gap-1 rounded-xl border border-primary/40 px-3 py-2 text-xs font-semibold text-primary sm:flex"><Phone className="size-3.5" /> {CONTACT.call[0]}</a>
          <Link href={bookHref} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white">Book Now</Link>
          <details className="group relative lg:hidden">
            <summary aria-label="Open menu" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-xl border border-border text-[#0a2540] [&::-webkit-details-marker]:hidden"><Menu className="size-5" /></summary>
            <div className="fixed inset-x-0 top-[57px] max-h-[calc(100vh-57px)] overflow-y-auto border-b border-border bg-white p-3 shadow-xl">
              {NAV_MEGA.map((m) => (
                <div key={m.id} className="rounded-xl border border-border bg-[#eef4fb] [&+div]:mt-2">
                  <p className="px-4 pt-3 text-sm font-extrabold text-[#0a2540]">{m.label}</p>
                  <div className="space-y-3 px-4 pb-4 pt-2">
                    {m.pillars.map((p) => (
                      <section key={p.title}>
                        <Link href={p.href} className="text-sm font-bold text-primary">{p.title}</Link>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {p.items.map((i) => <li key={`${p.title}-${i.label}`}><Link href={i.href} className="inline-block rounded-full bg-white px-2.5 py-1 text-xs text-[#0a2540]/85 ring-1 ring-border">{i.label}</Link></li>)}
                        </ul>
                      </section>
                    ))}
                  </div>
                </div>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm font-bold">
                <Link href="/offers" className="rounded-xl border border-border py-3 text-[#0a2540]">Offers</Link>
                <Link href="/contact" className="rounded-xl border border-border py-3 text-[#0a2540]">Contact</Link>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
