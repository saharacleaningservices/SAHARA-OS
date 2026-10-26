import { CLIENT_LOGOS, type ClientLogo } from "@/lib/client-logos";

// "Trusted by" corporate logo strip: a slow, pausable marquee (CSS only, no JS). Renders nothing until real client logos are added to
// src/lib/client-logos.ts, so a placeholder or invented client is never shown. The list is doubled for a seamless loop; the copy is aria-hidden.
export function ClientLogosSlider({ logos = CLIENT_LOGOS }: { logos?: ClientLogo[] }) {
  if (logos.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={hidden || undefined}>
      {logos.map((l) => (
        <li key={`${hidden}-${l.name}`} className="flex h-14 w-32 shrink-0 items-center justify-center">
          <img src={l.src} alt={hidden ? "" : l.name} loading="lazy" className="max-h-12 max-w-full object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-labelledby="trusted-by" className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 id="trusted-by" className="text-center text-sm font-bold uppercase tracking-wide text-[#0a2540]/70">Trusted by businesses across Pune</h2>
      <div className="group mt-3 overflow-hidden" data-client-logos>
        <div className="flex w-max animate-[sahara-marquee_30s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {row(false)}
          {row(true)}
        </div>
      </div>
      <style>{`@keyframes sahara-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </section>
  );
}
