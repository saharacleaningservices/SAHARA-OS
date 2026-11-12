import { BRANCHES, SERVICE_CATEGORIES, VERTICALS, ZONES, branchForLocality, localityBySlug, type Locality, type ServiceCategory } from "@/config/pune-seo-matrix";

// Copy builders for the programmatic pages. Every page gets its own title / description / paragraphs built from locality
// facts (landmarks, premises, zone, branch; PIN codes stay in JSON-LD only) so no two pages are near-duplicates. Facts only: no prices, no superlatives.

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/[\s,;:.-]+\S*$/, "")}…`);

export function seoTitle(c: ServiceCategory, l: Locality): string {
  // Owner 2026-11-02: no raw PIN codes on the frontend (titles show in Google results) — keyword-first local title.
  const full = `${c.short} in ${l.name}, Pune | Sahara Cleaning`;
  return full.length <= 66 ? full : `${c.short} in ${l.name}, Pune | Sahara`;
}

export function seoDescription(c: ServiceCategory, l: Locality): string {
  const b = branchForLocality(l);
  return clip(`${c.name} in ${l.name}, Pune for ${l.premises}. Trained in-house staff and a written quote before work. Call ${b.phone} or WhatsApp.`, 158);
}

export function h1(c: ServiceCategory, l: Locality): string {
  return `${c.name} in ${l.name}, Pune`;
}

export function localIntro(c: ServiceCategory, l: Locality): string {
  const lm = l.landmarks.slice(0, 3).join(", ");
  return `${c.intro} ${l.name} sits in ${ZONES[l.zone].label}, where Sahara is mostly asked to look after ${l.premises}. Our crew regularly works around ${lm}.`;
}

export function pageFaqs(c: ServiceCategory, l: Locality) {
  const b = branchForLocality(l);
  return [
    { q: `Do you provide ${c.keyword} in ${l.name}, Pune?`, a: `Yes. Sahara Cleaning Services serves ${l.name} and the rest of Pune and Pimpri-Chinchwad. Our trained in-house crew handles ${c.name} here.` },
    ...c.faq(l.name),
    { q: `How do I book ${c.keyword} in ${l.name}?`, a: `Send the enquiry form on this page, WhatsApp +91 ${b.whatsapp.slice(0, 5)} ${b.whatsapp.slice(5)} or call +91 ${b.phone.slice(0, 5)} ${b.phone.slice(5)}. The office confirms the date and scope before work starts.` },
  ];
}

export function siblingServices(l: Locality) {
  return SERVICE_CATEGORIES.map((c) => ({ slug: c.slug, name: c.short, href: `/services/${c.slug}/${l.slug}` }));
}

export function nearbyLocalities(l: Locality) {
  return l.near.map((s) => localityBySlug(s)).filter((x): x is Locality => !!x);
}

export const verticalLabel = (c: ServiceCategory) => VERTICALS[c.vertical].label;
export const branchLine = (l: Locality) => BRANCHES[ZONES[l.zone].branch];
