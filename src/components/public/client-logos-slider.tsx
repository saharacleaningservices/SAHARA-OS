import { CLIENT_LOGOS, type ClientLogo } from "@/lib/client-logos";
import { ClientCarousel } from "@/components/ui/client-carousel";

// "Trusted by" corporate logo strip. Since 2026-11-01 this is a thin wrapper around the single shared ClientCarousel
// (src/components/ui/client-carousel.tsx) — one marquee implementation, no duplicated static grids. Renders nothing until real
// client logos are added to src/lib/client-logos.ts, so a placeholder or invented client is never shown.
export function ClientLogosSlider({ logos = CLIENT_LOGOS }: { logos?: ClientLogo[] }) {
  if (logos.length === 0) return null;
  return <ClientCarousel logos={logos} />;
}
