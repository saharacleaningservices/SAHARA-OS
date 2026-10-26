import Link from "next/link";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { FooterSocial } from "@/components/public/footer-social";
import { MapOnTap } from "@/components/public/map-on-tap";
import { FOOTER_SERVICE_LINKS } from "@/components/public/landing-kit";
import { MAP_QUERY } from "@/components/public/areas-map-block";
import { CONTACT, GOOGLE_MAPS_URL, LOCALITIES, WEBSITE_URL } from "@/lib/marketing-content";
import { COMPANY } from "@/lib/constants";

// The /booking footer (owner 2026-10-26): ONE dark-blue block, top to bottom —
//   Visit us (address + phones + e-mail) → the interactive Google Map → services / company links with the GSTIN and social icons (once)
//   → Areas we serve (last). The "since 2012" line is not repeated (the hero says it), and there is no second map or social row.
export async function BookingFooter() {
  const card = "rounded-2xl bg-white/5 p-4 ring-1 ring-white/10";
  return (
    <footer className="mt-6 bg-[#0a2540] text-white/80" data-booking-footer>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 text-sm sm:py-8">
        <section aria-labelledby="bf-visit" className={`${card} space-y-3`}>
          <h2 id="bf-visit" className="text-base font-extrabold text-white">Visit us</h2>
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1.2fr]">
            <address className="flex gap-1.5 not-italic text-white/85"><MapPin className="mt-0.5 size-4 shrink-0 text-amber-400" />{CONTACT.address}</address>
            <p className="flex flex-col gap-1 text-[13px] font-semibold text-white">
              {CONTACT.call.map((n) => (
                <a key={n} href={`tel:+91${n}`} className="inline-flex min-h-9 items-center gap-1.5 hover:text-amber-300"><Phone className="size-3.5 shrink-0" />+91 {n.slice(0, 5)} {n.slice(5)}</a>
              ))}
            </p>
            <div className="flex flex-col gap-1 text-[13px]">
              <a href={`mailto:${CONTACT.email}`} className="inline-flex min-h-9 items-center gap-1.5 break-all hover:text-white"><Mail className="size-3.5 shrink-0" />{CONTACT.email}</a>
              <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 break-all hover:text-white"><Globe className="size-3.5 shrink-0" />www.saharacleaningservices.com</a>
            </div>
          </div>
          <MapOnTap title="Sahara Cleaning Services on Google Maps" embedSrc={`https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&output=embed`} mapsUrl={GOOGLE_MAPS_URL} address={CONTACT.address} />
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <section aria-labelledby="bf-services" className={`${card} space-y-2`}>
            <h2 id="bf-services" className="text-base font-extrabold text-white">Our services</h2>
            <ul className="space-y-1.5 text-[13px]">
              {FOOTER_SERVICE_LINKS.map((l) => (
                <li key={l.href}><Link href={l.href} className="hover:text-white">{l.label}</Link></li>
              ))}
              <li><Link href="/booking#book" className="font-semibold text-amber-400">Book Online</Link></li>
            </ul>
          </section>
          <section aria-labelledby="bf-company" className={`${card} space-y-3`}>
            <h2 id="bf-company" className="text-base font-extrabold text-white">Sahara Cleaning Services</h2>
            <p className="text-[13px]">GSTIN: <span className="font-semibold text-white">{COMPANY.gstin}</span></p>
            <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
              <Link href="/privacy-policy" className="inline-flex min-h-9 items-center underline hover:text-white">Privacy Policy</Link><span aria-hidden>·</span>
              <Link href="/terms" className="inline-flex min-h-9 items-center underline hover:text-white">Terms &amp; Conditions</Link><span aria-hidden>·</span>
              <Link href="/gallery" className="inline-flex min-h-9 items-center underline hover:text-white">Our work</Link>
            </p>
            <FooterSocial />
          </section>
        </div>

        <section aria-labelledby="bf-areas" className="space-y-2">
          <h2 id="bf-areas" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white"><MapPin className="size-3.5" /> Areas we serve</h2>
          <ul className="flex flex-wrap gap-1.5">
            {LOCALITIES.filter((l) => l !== "Other").map((l) => <li key={l} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85">{l}</li>)}
          </ul>
        </section>
      </div>
      <div className="border-t border-white/10"><p className="mx-auto max-w-6xl px-4 py-3 text-center text-[11px] text-white/50">© Sahara Cleaning Services</p></div>
    </footer>
  );
}
