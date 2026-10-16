"use client";

import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";

// Footer map for the campaign pages. The embedded Google Map pulls ~450 KiB / ~17 requests of Google
// JavaScript, so it is mounted only after an explicit tap. Until then a lightweight static card shows the
// address and a plain "View on Google Maps" link (opens the Google Business Profile listing).
export function MapOnTap({ embedSrc, mapsUrl, title, address }: { embedSrc: string; mapsUrl: string; title: string; address: string }) {
  const [open, setOpen] = useState(false);
  const size = "h-52 w-full rounded-xl md:h-full md:min-h-56";
  if (open) {
    return <iframe title={title} src={embedSrc} referrerPolicy="no-referrer-when-downgrade" className={`${size} border-0`} />;
  }
  return (
    <div className={`${size} flex flex-col items-center justify-center gap-3 border border-primary/20 bg-primary/5 p-4 text-center`}>
      <MapPin className="size-6 text-primary" aria-hidden />
      <p className="text-sm font-semibold text-[#0a2540]">{address}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-white"
        >
          View on Google Maps <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center rounded-full border border-primary/40 px-4 text-sm font-medium text-primary"
        >
          Show map here
        </button>
      </div>
    </div>
  );
}
