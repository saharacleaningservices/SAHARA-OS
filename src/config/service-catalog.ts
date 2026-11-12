// Public service catalog (owner rebuild directive 2026-11-02) — ONE source for the 4-category mega menu, the homepage
// category grid, every /services/<slug> page, the sitemap and the Service JSON-LD.
//
// Pricing rule: no price is written here. A service is either
//   "bhk"        → fixed 1/2/3 BHK Premium & Platinum rate cards read live from the pricing master (4 BHK & villas: on inspection),
//   "from"       → a "starting from" rate read live from the pricing master by contentId,
//   "pest"       → flat 1–4 BHK rate table per treatment (src/lib/pricing-master.ts PEST_BHK_RATES),
//   "inspection" → no price on the page; "Request Site Inspection / Quote" with the 4-step inspection explainer.
// Where a catalog slug equals a pune-seo-matrix category slug the page also lists every area page for it, so no ranking URL
// changes. `seoCategory` points a catalog service at the matrix category whose area pages it should link to.

import { img } from "@/config/image-registry";

export type CatalogCategoryId = "residential" | "individual" | "commercial" | "relocation";
export type PricingMode = "bhk" | "from" | "pest" | "inspection" | "unfurnished";

export type CatalogService = {
  slug: string;
  category: CatalogCategoryId;
  name: string;
  /** One line for menus and cards. */
  blurb: string;
  /** One factual sentence for the page hero and meta description. */
  intro: string;
  includes: string[];
  /** Short hero bullets (owner 2026-11-03: keep the hero above the fold on phones). Defaults to the first three includes. */
  heroPoints?: string[];
  /** Short hero sub-line; defaults to intro. */
  heroIntro?: string;
  /** What is NOT part of the job (falls back to the category default in excludesFor()). */
  excludes?: string[];
  pricing: { mode: PricingMode; contentIds?: string[] };
  image: string;
  imageAlt: string;
  /** GalleryItem.category value(s) whose before/after photos belong on this page (src/lib/gallery.ts GALLERY_CATEGORIES). */
  gallery: string;
  /** pune-seo-matrix category slug for the "available in your area" links. */
  seoCategory?: string;
  faqs: { q: string; a: string }[];
};

export type CatalogCategory = { id: CatalogCategoryId; slug: string; label: string; short: string; blurb: string; image: string };

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  { id: "residential", slug: "residential-services", label: "Residential Services", short: "Residential", blurb: "Full-home deep cleaning, pest control and painting for flats, villas and bungalows", image: img("full-home").src },
  { id: "individual", slug: "individual-services", label: "Individual Services", short: "Individual", blurb: "Only the room or item you need — kitchen, bathroom, sofa, carpet, windows", image: img("express").src },
  { id: "commercial", slug: "commercial-services", label: "Commercial Services (B2B)", short: "Commercial", blurb: "Offices, showrooms, warehouses, restaurants, façades and facility-management AMCs", image: img("housekeeping").src },
  { id: "relocation", slug: "relocation-property-services", label: "Relocation & Property Services", short: "Relocation & Property", blurb: "Packers & movers, rent agreements with police verification, and property snagging", image: img("team").src },
];

const HOME_FAQ_TIME = { q: "How long does it take?", a: "A typical 2 BHK is finished in one day by a small crew; larger homes take longer. The team lead confirms the schedule when you book." };
const BRING = { q: "Do I need to arrange equipment or chemicals?", a: "No. Sahara brings the machines, tools and chemicals. Please keep water and power available." };
const VISIT = { q: "How is the price decided?", a: "A Sahara supervisor visits the site, measures the scope and sends a written quotation. The visit is free and carries no obligation." };

export const CATALOG_SERVICES: CatalogService[] = [
  // ── Residential ─────────────────────────────────────────────────────────
  {
    slug: "home-deep-cleaning", category: "residential", name: "Full House Deep Cleaning", blurb: "Fixed 1/2/3 BHK rates — Premium or Platinum",
    intro: "Room-by-room deep cleaning of furnished flats, villas and bungalows by trained in-house staff using machines and professional chemicals.",
    includes: ["Kitchen platform, tiles and exhaust degreasing", "Bathroom descaling — WC, basin, fittings, wall & floor tiles", "Window glass and sliding-channel cleaning", "Floor scrubbing and mopping", "Fans, lights, doors and switchboards", "Balcony cleaning and cobweb removal"],
    pricing: { mode: "bhk" }, image: img("full-home").src, imageAlt: img("full-home").alt,
    gallery: "Home Deep Cleaning", seoCategory: "home-deep-cleaning", faqs: [HOME_FAQ_TIME, BRING, { q: "What is the difference between Premium and Platinum?", a: "Both cover the full home. Platinum adds wall wet cleaning; Premium includes wall and ceiling dry dusting." }],
  },
  {
    slug: "unfurnished-home-cleaning", category: "residential", name: "Unfurnished Home Cleaning", blurb: "Empty flats — fixed 1 / 2 / 3 BHK rates",
    intro: "Deep cleaning of empty flats and villas — every surface is reachable, so the crew finishes faster and more thoroughly.",
    includes: ["Paint, cement and dust marks removed from floors", "Kitchen and bathroom descaling", "Wardrobe and cabinet interiors", "Windows, grills and sliding channels", "Balcony and utility area scrubbing"],
    pricing: { mode: "unfurnished" }, image: img("clean-room").src, imageAlt: img("clean-room").alt,
    gallery: "Home Deep Cleaning", seoCategory: "home-deep-cleaning", faqs: [HOME_FAQ_TIME, BRING],
  },
  {
    slug: "move-in-move-out-cleaning", category: "residential", name: "Move-in / Move-out Cleaning", blurb: "Handover-ready cleaning for tenants and owners",
    intro: "A complete deep clean timed around your shifting date, so the home is ready for handover or for your family to move in.",
    includes: ["Full-home deep cleaning at BHK rates", "Cabinet, wardrobe and loft interiors", "Bathroom and kitchen descaling", "Fittings, switchboards and doors wiped", "Photos shared after the job on request"],
    pricing: { mode: "bhk" }, image: img("team").src, imageAlt: img("team").alt,
    gallery: "Home Deep Cleaning", seoCategory: "home-deep-cleaning", faqs: [HOME_FAQ_TIME, { q: "Can you clean on the day the keys are handed over?", a: "Yes, subject to slot availability. Book a few days ahead for weekends and month-end dates." }],
  },
  {
    slug: "post-interior-cleaning", category: "residential", name: "Post-Interior Cleaning", blurb: "After carpentry, false ceiling and painting work",
    intro: "Removal of fine dust, paint splashes, adhesive and cement residue after interior work, before the family moves in.",
    includes: ["Fine-dust vacuuming of every surface", "Paint, putty and cement residue removal", "Glass, frames and sliding channels", "Wardrobe and modular-kitchen interiors", "Bathroom fittings and tile grout"],
    pricing: { mode: "inspection" }, image: img("post-interior").src, imageAlt: img("post-interior").alt,
    gallery: "Home Deep Cleaning", seoCategory: "post-interior-cleaning", faqs: [VISIT, BRING],
  },
  {
    slug: "pest-control", category: "residential", name: "Pest Control", blurb: "Cockroach, termite, bed bug, ant and rodent",
    intro: "Flat-rate treatment for cockroaches, ants, bed bugs, rodents, termites and mosquitoes in 1–4 BHK homes, by trained technicians.",
    heroIntro: "Flat-rate treatment for 1–4 BHK homes.", heroPoints: ["Cockroach, ant & bed bug", "Termite & rodent", "Follow-up where applicable"],
    includes: ["Inspection of kitchen, bathrooms and drains", "Gel baiting in cracks and crevices", "Anti-termite treatment of affected woodwork", "Bed-bug treatment of beds and furniture", "Aftercare advice and follow-up visit where applicable"],
    pricing: { mode: "pest" }, image: img("pest").src, imageAlt: img("pest").alt,
    gallery: "Pest Control", seoCategory: "pest-control", faqs: [{ q: "How is pest control priced?", a: "Flat rates by home size (1–4 BHK) for each treatment, shown on this page. Villas, bungalows and commercial premises are quoted after a free inspection." }, { q: "Is the treatment safe for children and pets?", a: "The technician explains the precautions before starting and tells you when rooms can be used again." }],
  },
  {
    slug: "interior-painting", category: "residential", name: "Interior Painting", blurb: "Asian Paints range — free site inspection first",
    intro: "Interior painting with Asian Paints emulsions, putty and texture finishes, with furniture covered and the site cleaned afterwards.",
    heroIntro: "Asian Paints finishes with furniture covered and clean-up after.", heroPoints: ["Free site inspection", "Putty, primer + 2 coats", "Post-painting cleaning"],
    includes: ["Free site inspection and measurement", "Furniture and floor covering", "Putty, primer and two coats", "Asian Paints Tractor, Premium, Royale and Royale Lustre", "Post-painting cleaning"],
    pricing: { mode: "inspection" }, image: img("painting").src, imageAlt: img("painting").alt,
    gallery: "Interior Painting", seoCategory: "interior-painting", faqs: [VISIT],
  },
  // ── Individual ──────────────────────────────────────────────────────────
  {
    slug: "kitchen-deep-cleaning", category: "individual", name: "Kitchen Deep Cleaning", blurb: "Degreasing of platform, tiles, cabinets and exhaust",
    intro: "Deep degreasing of the kitchen platform, wall tiles, cabinets, trolleys, sink and exhaust fan.",
    includes: ["Platform and wall-tile degreasing", "Cabinet and trolley exteriors (interiors when emptied)", "Sink and tap descaling", "Exhaust fan cleaning", "Floor scrubbing"],
    pricing: { mode: "from", contentIds: ["SCS-12", "SCS-33"] }, image: img("kitchen").src, imageAlt: img("kitchen").alt,
    gallery: "Kitchen & Bathroom", seoCategory: "kitchen-bathroom-cleaning", faqs: [{ q: "Is chimney cleaning included?", a: "No. Chimney cleaning is not part of this service." }, BRING],
  },
  {
    slug: "bathroom-deep-cleaning", category: "individual", name: "Bathroom Deep Cleaning", blurb: "Descaling of tiles, grout, WC and fittings",
    intro: "Machine scrubbing and descaling of bathroom tiles, grout, WC, basin, mirrors and fittings.",
    includes: ["Hard-water stain and scale removal", "Wall and floor tile grout scrubbing", "WC, basin and shower area", "Taps, fittings and mirrors", "Exhaust fan and door"],
    pricing: { mode: "from", contentIds: ["SCS-10"] }, image: img("bathroom").src, imageAlt: img("bathroom").alt,
    gallery: "Kitchen & Bathroom", seoCategory: "kitchen-bathroom-cleaning", faqs: [BRING],
  },
  {
    slug: "sofa-upholstery-cleaning", category: "individual", name: "Sofa & Upholstery Cleaning", blurb: "Extraction shampooing of fabric sofas and chairs",
    intro: "Shampooing and wet extraction of fabric sofas, dining chairs and upholstery to lift stains, dust and odour.",
    heroIntro: "Shampoo and extraction for fabric sofas and chairs.", heroPoints: ["Stain pre-treatment", "Machine wet extraction", "Fast-dry finish"],
    includes: ["Dry vacuuming", "Shampoo pre-treatment of stains", "Machine wet extraction", "Fast-dry finish", "Mattress cleaning available as an add-on"],
    pricing: { mode: "from", contentIds: ["SCS-09", "SCS-11"] }, image: img("sofa").src, imageAlt: img("sofa").alt,
    gallery: "Sofa & Carpet", seoCategory: "sofa-carpet-mattress-cleaning", faqs: [{ q: "How long does the sofa take to dry?", a: "Usually a few hours with ventilation; the technician advises on the day." }],
  },
  {
    slug: "carpet-cleaning", category: "individual", name: "Carpet Cleaning", blurb: "Shampooing and extraction of rugs and carpets",
    intro: "Shampooing and wet extraction of rugs and wall-to-wall carpets at home or in the office.",
    includes: ["Dry vacuuming", "Spot pre-treatment", "Shampoo and wet extraction", "Edge and pile grooming"],
    pricing: { mode: "from", contentIds: ["SCS-13"] }, image: img("carpet").src, imageAlt: img("carpet").alt,
    gallery: "Sofa & Carpet", seoCategory: "sofa-carpet-mattress-cleaning", faqs: [{ q: "How is carpet cleaning priced?", a: "By size and material. The price is confirmed before booking." }],
  },
  {
    slug: "window-cleaning", category: "individual", name: "Window Cleaning", blurb: "Glass, grills and sliding channels — per window",
    intro: "Cleaning of window glass, frames, grills and sliding channels, charged per window.",
    includes: ["Window glass inside and outside where reachable", "Frame and grill cleaning", "Sliding-channel vacuuming", "Hard-water spot removal", "Mesh / net wipe-down"],
    pricing: { mode: "from", contentIds: ["SCS-30"] }, image: img("window").src, imageAlt: img("window").alt,
    gallery: "Home Deep Cleaning", seoCategory: "window-floor-cleaning", faqs: [{ q: "Do you clean high-rise exterior glass?", a: "Exterior glass that needs rope access is a commercial façade job and is quoted after a site visit." }],
  },
  {
    slug: "balcony-cleaning", category: "individual", name: "Balcony Cleaning", blurb: "Floor scrubbing, railings and grills",
    intro: "Scrubbing of balcony floors and drains with railing, grill and ledge cleaning.",
    includes: ["Floor machine / manual scrubbing", "Drain outlet cleaning", "Railing and grill wipe-down", "Ledge and wall-tile cleaning", "Cobweb removal"],
    pricing: { mode: "from", contentIds: ["SCS-34"] }, image: img("clean-room").src, imageAlt: img("clean-room").alt,
    gallery: "Home Deep Cleaning", seoCategory: "window-floor-cleaning", faqs: [{ q: "How is balcony cleaning priced?", a: "By balcony size and condition; the price is confirmed before booking." }],
  },
  // ── Commercial (B2B) — always on inspection ───────────────────────────────
  {
    slug: "office-cleaning-housekeeping", category: "commercial", name: "Office Cleaning", blurb: "One-time deep clean or daily housekeeping",
    intro: "Deep cleaning and daily housekeeping of offices, IT floors, pantries and washrooms, scheduled around working hours.",
    includes: ["Workstation, cabin and conference-room cleaning", "Carpet vacuuming and shampooing", "Pantry and washroom deep cleaning", "Glass partitions and doors", "Night or weekend shifts available"],
    pricing: { mode: "inspection" }, image: img("office").src, imageAlt: img("office").alt,
    gallery: "Commercial Cleaning", seoCategory: "office-cleaning-housekeeping", faqs: [VISIT],
  },
  {
    slug: "showroom-cleaning", category: "commercial", name: "Showroom Cleaning", blurb: "Display floors, glass and fixtures before opening hours",
    intro: "Cleaning of retail showrooms — display glass, flooring, fixtures and back-of-house — before or after trading hours.",
    includes: ["Display glass and mirror polishing", "Floor scrubbing and polishing", "Fixture and signage dusting", "Trial rooms and washrooms", "Early-morning slots"],
    pricing: { mode: "inspection" }, image: img("commercial").src, imageAlt: img("commercial").alt,
    gallery: "Commercial Cleaning", seoCategory: "industrial-showroom-facade-cleaning", faqs: [VISIT],
  },
  {
    slug: "warehouse-cleaning", category: "commercial", name: "Warehouse Cleaning", blurb: "Large floors, racks and loading bays",
    intro: "Mechanised cleaning of warehouse floors, racking, loading bays and amenities for logistics and industrial units.",
    includes: ["Ride-on or walk-behind floor scrubbing", "Rack and high-level dusting", "Loading bay degreasing", "Washroom and canteen cleaning", "Shift-wise crew planning"],
    pricing: { mode: "inspection" }, image: img("parking").src, imageAlt: img("parking").alt,
    gallery: "Commercial Cleaning", seoCategory: "industrial-showroom-facade-cleaning", faqs: [VISIT],
  },
  {
    slug: "facade-glass-cleaning", category: "commercial", name: "Facade & Glass Cleaning", blurb: "Exterior glass and cladding for buildings",
    intro: "Cleaning of exterior glass and façade cladding on commercial and residential buildings, planned after a safety survey.",
    includes: ["Site and access safety survey", "Exterior glass and ACP cladding", "Hard-water stain removal", "Safety-equipped crew", "Society and commercial buildings"],
    pricing: { mode: "inspection" }, image: img("commercial").src, imageAlt: img("commercial").alt,
    gallery: "Commercial Cleaning", seoCategory: "industrial-showroom-facade-cleaning", faqs: [VISIT],
  },
  {
    slug: "restaurant-kitchen-cleaning", category: "commercial", name: "Commercial Kitchen / Restaurant Cleaning", blurb: "Degreasing of kitchens, dining areas and drains",
    intro: "Heavy degreasing of commercial kitchens plus dining-area, washroom and drain cleaning for restaurants, cafés and cloud kitchens.",
    includes: ["Hood, wall and equipment degreasing", "Floor and drain scrubbing", "Dining area and washrooms", "Night-shift scheduling", "Pest control add-on available"],
    pricing: { mode: "inspection" }, image: img("restaurant").src, imageAlt: img("restaurant").alt,
    gallery: "Commercial Cleaning", seoCategory: "office-cleaning-housekeeping", faqs: [VISIT],
  },
  {
    slug: "post-construction-cleaning", category: "commercial", name: "Post-Construction Cleaning", blurb: "Handover cleaning for builders and architects",
    intro: "Builder-handover cleaning of new offices, flats and commercial units — construction dust, cement, paint and adhesive removal.",
    includes: ["Debris and fine-dust removal", "Cement, paint and adhesive residue", "Glass, frames and fittings", "Floor scrubbing and polishing", "Multi-unit and tower projects"],
    pricing: { mode: "inspection" }, image: img("post-construction").src, imageAlt: img("post-construction").alt,
    gallery: "Commercial Cleaning", seoCategory: "post-interior-cleaning", faqs: [VISIT],
  },
  {
    slug: "facility-management", category: "commercial", name: "Commercial AMC & Facility Management", blurb: "Housekeeping staff, pantry and soft services on contract",
    intro: "Annual contracts for housekeeping staff, pantry support and soft services in offices, societies, hospitals and showrooms.",
    includes: ["Trained, uniformed housekeeping staff", "Supervisor and attendance tracking", "Consumables plan on request", "Periodic deep cleaning in the AMC", "One consolidated invoice each month"],
    pricing: { mode: "inspection" }, image: img("housekeeping").src, imageAlt: img("housekeeping").alt,
    gallery: "Commercial Cleaning", seoCategory: "facility-management", faqs: [VISIT],
  },
  // ── Relocation & Property — quoted per job ───────────────────────────────
  {
    slug: "packers-and-movers", category: "relocation", name: "Packers & Movers", blurb: "Home and office shifting within Pune",
    intro: "Packing, loading, transport and unpacking for home and office shifting within Pune and PCMC, quoted after a survey.",
    includes: ["Free pre-move survey", "Packing material and labelled cartons", "Loading, transport and unloading", "Furniture dismantling and refitting", "Move-in cleaning add-on"],
    pricing: { mode: "inspection" }, image: img("team").src, imageAlt: img("team").alt,
    gallery: "Other", faqs: [{ q: "How is shifting priced?", a: "By volume, distance and floor access. A free survey is done before the written quote." }, { q: "Can you clean the new home before we move in?", a: "Yes. Move-in cleaning can be booked with the shifting at the same time." }],
  },
  {
    slug: "rent-agreement-police-verification", category: "relocation", name: "Rent Agreement & Police Verification", blurb: "Registered rent agreement with tenant verification",
    intro: "Help with online registered leave-and-licence agreements and tenant police verification for owners and tenants in Pune.",
    includes: ["Document checklist for owner and tenant", "Draft leave-and-licence agreement", "Registration appointment coordination", "Tenant police verification submission", "Copies shared on WhatsApp and email"],
    pricing: { mode: "inspection" }, image: img("clean-room").src, imageAlt: img("clean-room").alt,
    gallery: "Other", faqs: [{ q: "Which documents are needed?", a: "Identity and address proof for owner and tenant, and property papers. We share the exact checklist on WhatsApp." }, { q: "How is it priced?", a: "Government stamp duty and registration charges are as applicable; our service fee is quoted before we start." }],
  },
  {
    slug: "property-snagging-inspection", category: "relocation", name: "Property Snagging / Home Inspection", blurb: "Defect check before you take possession",
    intro: "Room-by-room inspection of a new or resale flat before possession — civil, plumbing, electrical and finishing defects listed for the builder.",
    includes: ["Walls, tiles, doors and windows checked", "Plumbing leak and slope checks", "Electrical points tested", "Photo report with defect list", "Re-check visit after rectification"],
    pricing: { mode: "inspection" }, image: img("clean-room").src, imageAlt: img("clean-room").alt,
    gallery: "Other", faqs: [{ q: "When should I book snagging?", a: "Before you accept possession, so the builder can fix defects under the handover." }],
  },
];

export const catalogServiceBySlug = (slug: string) => CATALOG_SERVICES.find((s) => s.slug === slug);
export const servicesIn = (id: CatalogCategoryId) => CATALOG_SERVICES.filter((s) => s.category === id);
export const servicePath = (slug: string) => `/services/${slug}`;
export const catalogCategory = (id: CatalogCategoryId) => CATALOG_CATEGORIES.find((c) => c.id === id)!;

/** The four steps shown wherever a service is quoted on inspection. */
export const INSPECTION_STEPS = [
  { title: "Request", body: "Send your requirement in 30 seconds — or call / WhatsApp either branch." },
  { title: "Site visit", body: "A Sahara supervisor visits at your chosen time to measure the scope. Free, no obligation." },
  { title: "Written quote", body: "You receive a written quotation with scope, manpower and timeline." },
  { title: "Work & handover", body: "Our in-house crew completes the job; you check it before handover and pay as agreed." },
] as const;

/** Category landing page path, e.g. /services/individual-services. */
export const categoryPath = (id: CatalogCategoryId) => `/services/${catalogCategory(id).slug}`;
export const catalogCategoryBySlug = (slug: string) => CATALOG_CATEGORIES.find((c) => c.slug === slug);

const DEFAULT_EXCLUDES: Record<CatalogCategoryId, string[]> = {
  residential: ["Moving heavy furniture or appliances", "Inaccessible or unsafe heights", "Old permanent stains (no guarantee of full removal)", "Water and electricity (provided by the customer)"],
  individual: ["Areas outside the booked item / room", "Moving heavy furniture", "Old permanent stains (no guarantee of full removal)", "Water and electricity (provided by the customer)"],
  commercial: ["Work outside the written quotation", "Civil, plumbing or electrical repairs", "Consumables unless listed in the quote", "Rope-access work without a safety survey"],
  relocation: ["Government stamp duty and registration fees", "Items not listed in the survey", "Repairs to furniture or property", "Storage beyond the agreed date"],
};
export const excludesFor = (s: CatalogService) => s.excludes ?? DEFAULT_EXCLUDES[s.category];
