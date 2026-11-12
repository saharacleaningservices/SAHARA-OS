// Service-page hero slider content. Honest-photos rule (owner 2026-11-12): only genuine Sahara photos are shown.
// Per service category there is a folder /public/images/services/<folder>/. Drop real, edited job photos there as
//   before-1.webp, after-1.webp, before-2.webp, after-2.webp, … (.jpg / .jpeg / .png also work)
// and they appear automatically as labelled "Before" / "After" slides — no code change. Until then the slider shows real
// Sahara work photos from the central image registry (team at work, equipment, a finished room), never illustrations.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { img, type RegistryKey } from "@/config/image-registry";

export type SliderLabel = "Before" | "After" | "Our equipment" | "Our team" | "Finished result";
export type Slide = { src: string; alt: string; label: SliderLabel };

export type SlideFolder = "home" | "kitchen" | "bathroom" | "sofa" | "carpet" | "window" | "balcony";

/** Real registry photos per folder: [key, label, alt]. */
type Showcase = [RegistryKey, SliderLabel];
const FOLDERS: Record<SlideFolder, { subject: string; showcase: Showcase[] }> = {
  home: { subject: "living room and floor", showcase: [["hero-home", "Our equipment"], ["full-home", "Our team"], ["clean-room", "Finished result"]] },
  kitchen: { subject: "kitchen platform and tiles", showcase: [["kitchen", "Our equipment"], ["kitchen-wipe", "Our team"], ["clean-room", "Finished result"]] },
  bathroom: { subject: "bathroom tiles and fittings", showcase: [["bathroom", "Our equipment"], ["express", "Our team"], ["clean-room", "Finished result"]] },
  sofa: { subject: "fabric sofa", showcase: [["sofa", "Our equipment"], ["mattress", "Our team"], ["clean-room", "Finished result"]] },
  carpet: { subject: "carpet", showcase: [["carpet", "Our equipment"], ["commercial", "Our team"], ["clean-room", "Finished result"]] },
  window: { subject: "window glass and sliding channel", showcase: [["window", "Our equipment"], ["team", "Our team"], ["clean-room", "Finished result"]] },
  balcony: { subject: "balcony floor and railing", showcase: [["team", "Our team"], ["window", "Our equipment"], ["clean-room", "Finished result"]] },
};

const EXTS = ["webp", "jpg", "jpeg", "png"];
/** Real before/after pairs the owner has dropped into the folder (server-only; checked per render, cheap). */
export function beforeAfterPairsFor(folder: SlideFolder): { before: string; after: string; alt: string }[] {
  const dir = join(process.cwd(), "public", "images", "services", folder);
  const find = (kind: "before" | "after", n: number) => EXTS.map((e) => `${kind}-${n}.${e}`).find((f) => existsSync(join(dir, f)));
  const out: { before: string; after: string; alt: string }[] = [];
  for (let n = 1; n <= 8; n++) {
    const b = find("before", n), a = find("after", n);
    if (!b || !a) break;
    out.push({ before: `/images/services/${folder}/${b}`, after: `/images/services/${folder}/${a}`, alt: `${FOLDERS[folder].subject} cleaning` });
  }
  return out;
}

function realPairs(folder: SlideFolder): Slide[] {
  return beforeAfterPairsFor(folder).flatMap((p) => [
    { src: p.before, alt: `Before cleaning — ${FOLDERS[folder].subject}`, label: "Before" as const },
    { src: p.after, alt: `After Sahara deep cleaning — ${FOLDERS[folder].subject}`, label: "After" as const },
  ]);
}

/** Catalog service slug → photo folder. Services not listed here fall back to their own single hero photo. */
export const SERVICE_SLIDE_FOLDER: Record<string, SlideFolder> = {
  "home-deep-cleaning": "home",
  "unfurnished-home-cleaning": "home",
  "move-in-move-out-cleaning": "home",
  "kitchen-deep-cleaning": "kitchen",
  "bathroom-deep-cleaning": "bathroom",
  "sofa-upholstery-cleaning": "sofa",
  "carpet-cleaning": "carpet",
  "window-cleaning": "window",
  "balcony-cleaning": "balcony",
};

/** Real before/after pairs first (when uploaded), then real Sahara work photos. */
export function slidesForFolder(folder: SlideFolder): Slide[] {
  const f = FOLDERS[folder];
  return [...realPairs(folder), ...f.showcase.map(([key, label]) => ({ src: img(key).src, alt: img(key).alt, label }))];
}

/** Category-page showcases (e.g. /services/individual-services): several real photos instead of one static image. */
const CATEGORY_SHOWCASE: Record<string, Showcase[]> = {
  individual: [["kitchen", "Our equipment"], ["bathroom", "Our team"], ["sofa", "Our equipment"], ["window", "Our team"], ["clean-room", "Finished result"]],
  residential: [["hero-home", "Our equipment"], ["full-home", "Our team"], ["clean-room", "Finished result"], ["team", "Our team"]],
  commercial: [["commercial", "Our team"], ["office", "Our team"], ["housekeeping", "Our equipment"], ["restaurant", "Our team"]],
  relocation: [["post-construction", "Our team"], ["full-home", "Our team"], ["clean-room", "Finished result"]],
};
export function slidesForCategory(id: string, fallback: { src: string; alt: string }): Slide[] | { src: string; alt: string }[] {
  const show = CATEGORY_SHOWCASE[id];
  return show ? show.map(([key, label]) => ({ src: img(key).src, alt: img(key).alt, label })) : [fallback];
}

/** Slides for a service page; a single labelled-free photo when the service has no folder. */
export function slidesForService(slug: string, fallback: { src: string; alt: string }): Slide[] | { src: string; alt: string }[] {
  const folder = SERVICE_SLIDE_FOLDER[slug];
  return folder ? slidesForFolder(folder) : [fallback];
}
