// Service-page hero slider content (owner directive 2026-11-12). One folder of photos per service category under
// /public/images/services/<folder>/ — see the README there. `before-N` / `after-N` are styled placeholders until real,
// edited Sahara photos are dropped in; the "machine" slide is a real Sahara work photo from the central image registry.
//
// To swap in real photos: save them as before-1.webp / after-1.webp (…) in the folder, then change that folder's
// extension below from "svg" to "webp" (and add more pairs to `pairs`).

import { img, type RegistryKey } from "@/config/image-registry";

export type SliderLabel = "Before" | "After" | "Our equipment";
export type Slide = { src: string; alt: string; label: SliderLabel };

export type SlideFolder = "home" | "kitchen" | "bathroom" | "sofa" | "carpet" | "window" | "balcony";

const FOLDERS: Record<SlideFolder, { ext: string; pairs: number; subject: string; machine: RegistryKey; machineAlt: string }> = {
  home: { ext: "svg", pairs: 1, subject: "living room and floor", machine: "hero-home", machineAlt: "Sahara technician running a floor scrubbing machine" },
  kitchen: { ext: "svg", pairs: 1, subject: "kitchen platform and tiles", machine: "kitchen", machineAlt: "Sahara cleaner degreasing a kitchen chimney with professional equipment" },
  bathroom: { ext: "svg", pairs: 1, subject: "bathroom tiles and fittings", machine: "bathroom", machineAlt: "Sahara cleaner scrubbing a bathroom with a machine and descaling chemicals" },
  sofa: { ext: "svg", pairs: 1, subject: "fabric sofa", machine: "sofa", machineAlt: "Sahara team shampooing and extracting a sofa with an injection-extraction machine" },
  carpet: { ext: "svg", pairs: 1, subject: "carpet", machine: "carpet", machineAlt: "Sahara team vacuuming a carpet with commercial equipment" },
  window: { ext: "svg", pairs: 1, subject: "window glass and sliding channel", machine: "window", machineAlt: "Sahara cleaner squeegeeing window glass" },
  balcony: { ext: "svg", pairs: 1, subject: "balcony floor and railing", machine: "team", machineAlt: "Sahara cleaning team at work in a Pune home" },
};

/** Catalog service slug → photo folder. Services not listed here fall back to their own single hero photo. */
export const SERVICE_SLIDE_FOLDER: Record<string, SlideFolder> = {
  "home-deep-cleaning": "home",
  "unfurnished-home-cleaning": "home",
  "move-in-move-out-cleaning": "home",
  "kitchen-deep-cleaning": "kitchen",
  "bathroom-deep-cleaning": "bathroom",
  "sofa-upholstery-shampooing": "sofa",
  "carpet-cleaning": "carpet",
  "window-cleaning": "window",
  "balcony-cleaning": "balcony",
};

/** Before → After → equipment, per photo pair. */
export function slidesForFolder(folder: SlideFolder): Slide[] {
  const f = FOLDERS[folder];
  const out: Slide[] = [];
  for (let n = 1; n <= f.pairs; n++) {
    out.push({ src: `/images/services/${folder}/before-${n}.${f.ext}`, alt: `Before cleaning — ${f.subject}`, label: "Before" });
    out.push({ src: `/images/services/${folder}/after-${n}.${f.ext}`, alt: `After Sahara deep cleaning — ${f.subject}`, label: "After" });
  }
  out.push({ src: img(f.machine).src, alt: f.machineAlt, label: "Our equipment" });
  return out;
}

/** Slides for a service page; a single labelled-free photo when the service has no folder. */
export function slidesForService(slug: string, fallback: { src: string; alt: string }): Slide[] | { src: string; alt: string }[] {
  const folder = SERVICE_SLIDE_FOLDER[slug];
  return folder ? slidesForFolder(folder) : [fallback];
}
