import { MapPin } from "lucide-react";
import { MapOnTap } from "@/components/public/map-on-tap";
import { CONTACT, GOOGLE_MAPS_URL, LOCALITIES } from "@/lib/marketing-content";

// One "Areas We Serve" tag list + embedded Google Map, used by EVERY public footer (service landing pages, /book, /booking,
// campaign pages) so the two hosts never drift apart (owner 2026-10-25). Layout model: FLUID — tags wrap, the map stretches.
const MAP_QUERY = "Sahara Cleaning Services, Opposite South Gate, Magarpatta City, Hadapsar, Pune 411028";

export function AreasMapBlock({ dark = false }: { dark?: boolean }) {
  const tag = dark ? "bg-white/10 text-white/85" : "bg-primary/5 text-[#0a2540]/75";
  const head = dark ? "text-white" : "text-[#0a2540]";
  return (
    <div className={`mx-auto max-w-6xl space-y-3 px-4 py-5 ${dark ? "text-white/85" : "text-[#0a2540]/80"}`} data-areas-map>
      <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${head}`}><MapPin className="size-3.5" /> Areas we serve</p>
      <ul className="flex flex-wrap gap-1.5">
        {LOCALITIES.filter((l) => l !== "Other").map((l) => <li key={l} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tag}`}>{l}</li>)}
      </ul>
      <MapOnTap title="Sahara Cleaning Services on Google Maps" embedSrc={`https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&output=embed`} mapsUrl={GOOGLE_MAPS_URL} address={CONTACT.address} />
    </div>
  );
}
