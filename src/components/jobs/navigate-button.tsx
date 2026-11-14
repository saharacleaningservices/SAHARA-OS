import { Navigation } from "lucide-react";
import { googleMapsNavUrl } from "@/lib/maps";
import { cn } from "@/lib/utils";

/** One-tap turn-by-turn navigation to the customer's pin / address in Google Maps (opens the Maps app on phones). */
export function NavigateButton({ address, mapLink, className }: { address?: string | null; mapLink?: string | null; className?: string }) {
  const href = googleMapsNavUrl({ address, mapLink });
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90",
        className
      )}
    >
      <Navigation className="size-3.5" /> Navigate via Google Maps
    </a>
  );
}
