// Central Image Registry (Phase 2 refinements, 2026-11-02) — the ONE place that decides which picture each service shows.
// Every entry is a clean photo or illustration with NO text baked into the graphic (the old /marketing/catalog/* and offer
// banners carry headlines, phone numbers and logos, so they are WhatsApp/social creatives only — never site imagery).
// Paths are served through next/image, so when NEXT_PUBLIC_IMAGE_CDN is set (src/lib/image-loader.ts) every registry image
// is delivered from ImageKit / Cloudinary automatically. To swap a picture: drop the new file in /public and change it here.
// tests/phase2-2026-11-02.test.ts checks every path exists, the seven core services are all distinct, and none is text-baked.

export type RegistryImage = { src: string; alt: string };

export const IMAGE_REGISTRY = {
  // Owner final sprint 2026-11-02: clean photos cropped from the Sahara service creatives (no prices, headlines or phone numbers).
  "full-home": { src: "/marketing/services/full-home-crew.webp", alt: "Sahara crew scrubbing the floor, vacuuming the sofa and wiping windows during full house deep cleaning" },
  /** High-resolution wide shot kept for the full-width homepage hero (the cropped crew photo is card-sized). */
  "hero-home": { src: "/marketing/hero-home.webp", alt: "Sahara technician running a floor scrubber during full home deep cleaning" },
  kitchen: { src: "/marketing/services/kitchen-chimney.webp", alt: "Sahara cleaner degreasing a kitchen chimney above the hob" },
  bathroom: { src: "/marketing/services/bathroom-scrub.webp", alt: "Sahara cleaner scrubbing a WC and fittings during bathroom deep cleaning" },
  express: { src: "/marketing/services/express-cleaning.webp", alt: "Sahara cleaner wiping a living-room table during express cleaning" },
  sofa: { src: "/marketing/services/sofa-shampoo.webp", alt: "Sahara team shampooing and extracting a fabric sofa" },
  mattress: { src: "/marketing/services/mattress-steam.webp", alt: "Sahara technician steam-cleaning a mattress" },
  window: { src: "/marketing/services/window-glass.webp", alt: "Sahara cleaner squeegeeing high-rise window glass" },
  "post-construction": { src: "/marketing/services/post-construction.webp", alt: "Sahara crew clearing debris and dust after construction work" },
  housekeeping: { src: "/marketing/services/housekeeping.webp", alt: "Sahara housekeeper running a floor scrubber in a corporate lobby" },
  restaurant: { src: "/marketing/services/restaurant-cleaning.webp", alt: "Sahara cleaner sanitising restaurant dining tables" },
  hospital: { src: "/marketing/services/hospital-cleaning.webp", alt: "Sahara housekeeper mopping a hospital corridor" },
  parking: { src: "/marketing/services/parking-jet-wash.webp", alt: "Sahara cleaner jet-washing a basement parking floor" },
  "kitchen-wipe": { src: "/marketing/services/kitchen-wipe.webp", alt: "Sahara cleaner wiping a kitchen hob and platform" },
  pest: { src: "/marketing/service-pest-control.webp", alt: "Sahara pest control technician treating kitchen cabinet edges" },
  painting: { src: "/marketing/service-painting.webp", alt: "Sahara painters rolling and taping a living-room wall" },
  office: { src: "/marketing/services/office-team.webp", alt: "Sahara team vacuuming, mopping and wiping desks in an office" },
  carpet: { src: "/marketing/hero-commercial.webp", alt: "Carpet being vacuumed by the Sahara team" },
  commercial: { src: "/marketing/hero-commercial-v2.webp", alt: "Sahara team in Royal Blue uniforms cleaning commercial premises" },
  "clean-room": { src: "/marketing/carousel-result.webp", alt: "Freshly cleaned living room with glass windows" },
  team: { src: "/marketing/carousel-team.webp", alt: "Sahara cleaning team at work in a Pune home" },
  "post-interior": { src: "/marketing/hero-painting-3.webp", alt: "Living room being cleared of dust sheets after interior work" },
  "pest-termite": { src: "/marketing/hero-pest-2.webp", alt: "Technician inspecting a wardrobe base and door frame for termites" },
  "pest-drain": { src: "/marketing/hero-pest-3.webp", alt: "Technician treating a bathroom drain and skirting" },
  "pest-rodent": { src: "/marketing/hero-pest.webp", alt: "Technician treating kitchen cabinet bases" },
  "pest-backpack": { src: "/brand/hero/pest-control.jpg", alt: "Pest control technician with a sprayer pack" },
} as const satisfies Record<string, RegistryImage>;

export type RegistryKey = keyof typeof IMAGE_REGISTRY;
export const img = (key: RegistryKey): RegistryImage => IMAGE_REGISTRY[key];

/** The seven core services that must each show a different picture (owner 2026-11-02). */
export const CORE_SERVICE_IMAGE_KEYS: RegistryKey[] = ["full-home", "kitchen", "bathroom", "sofa", "pest", "painting", "office"];

/** Graphics with text baked in — never used as site imagery. */
export const TEXT_BAKED_PATTERNS = [/\/marketing\/catalog\//, /offer-banner/, /festival-banner/, /\/brand\/hero\/home-cleaning\.jpg$/, /booking-header/];
