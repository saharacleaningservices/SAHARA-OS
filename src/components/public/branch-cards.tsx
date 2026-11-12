import { MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { BRANCHES } from "@/config/pune-seo-matrix";
import { BUSINESS_GEO } from "@/lib/seo-schema";
import { waLink } from "@/lib/marketing-content";

const dir = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** Dual-branch interactive cards with direct Google Maps directions. Layout model: BOXED, 2 columns from md, stacked on mobile. */
export function BranchCards() {
  const cards = [
    { b: BRANCHES.magarpatta, geo: BUSINESS_GEO as { latitude: number; longitude: number }, address: "Opposite South Gate, Magarpatta City, Hadapsar, Pune" },
    { b: BRANCHES.mohammadwadi, geo: BRANCHES.mohammadwadi.geo ?? BUSINESS_GEO, address: `${BRANCHES.mohammadwadi.streetAddress ?? "Mohammadwadi"}, Pune` },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map(({ b, geo, address }) => {
        const phones = [b.phone, ...b.altPhones].filter((n, i, a) => a.indexOf(n) === i);
        return (
          <article key={b.key} className="group rounded-3xl border border-white/40 bg-white/70 p-5 shadow-lg backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-xl sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{b.key === "magarpatta" ? "Main branch" : "Branch"} · PIN {b.postalCode}</p>
            <h3 className="mt-1 text-xl font-extrabold text-[#0a2540]">{b.locality}</h3>
            <p className="mt-2 flex items-start gap-2 text-[15px] text-[#0a2540]/85"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />{address} — {b.postalCode}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <a href={dir(geo.latitude, geo.longitude)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0a2540] px-3 text-sm font-bold text-white"><Navigation className="size-4" /> Get directions</a>
              <a href={waLink(`Hi Sahara, I'd like to enquire (${b.locality} branch).`, b.whatsapp)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 text-sm font-bold text-white"><MessageCircle className="size-4" /> WhatsApp</a>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {phones.map((n) => <li key={n}><a href={`tel:+91${n}`} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/40 px-3 text-sm font-bold text-primary"><Phone className="size-3.5" /> {n.slice(0, 5)} {n.slice(5)}</a></li>)}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
