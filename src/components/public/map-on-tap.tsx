import { ExternalLink } from "lucide-react";

// Footer map (owner 2026-10-25): a live embedded Google Map instead of the old "View on Google Maps" card.
// loading="lazy" keeps it off the critical path — the browser fetches Google's map only when the footer nears the
// viewport, so the booking form's first paint is unaffected. A small link still opens the Business Profile listing.
// (File / export name kept so every footer import stays the same.)
export function MapOnTap({ embedSrc, mapsUrl, title, address }: { embedSrc: string; mapsUrl: string; title: string; address: string }) {
  return (
    <div className="space-y-1.5">
      <iframe
        title={title}
        src={embedSrc}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="h-56 w-full rounded-xl border-0 bg-primary/5 md:h-64"
      />
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
      >
        {address} <ExternalLink className="size-3" aria-hidden />
      </a>
    </div>
  );
}
