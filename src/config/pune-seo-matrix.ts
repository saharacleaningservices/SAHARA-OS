// Pune programmatic-SEO matrix (2026-11-01). ONE source of truth for the location landing pages
// /services/<category>/<location>, the B2B portals, the sitemap and the JSON-LD graph.
//
// Rules inherited from src/lib/seo-schema.ts: facts only — no prices, no "best/#1" claims, no invented client counts.
// Only the five core verticals below are Sahara services; no other service may be added here (tests/pune-seo-matrix.test.ts enforces it).
//
// PIN codes are the India Post delivery PINs most commonly used for each locality (some localities span several);
// they are used for search-intent copy and `areaServed`/postalCode, never as a promise of coverage per street.
// Branch assignment is a plain config choice (owner can flip any zone): see ZONES[*].branch.

export type ZoneKey = "east" | "west-pcmc" | "north" | "south-central";
export type BranchKey = "magarpatta" | "mohammadwadi";

export type Branch = {
  key: BranchKey;
  name: string;
  gmbName: string;
  phone: string; // 10-digit, customer-facing
  /** Further customer-facing numbers for this branch's schema (owner 2026-11-01: Mohammadwadi carries both 8956567130 and 7083347130). */
  altPhones: string[];
  /** GMB "Book online" action link for this branch — fixed UTM set so CRM badges it GMB Magarpatta / GMB Mohammadwadi. */
  bookOnlineUrl: string;
  whatsapp: string; // 10-digit wa.me target for this branch
  /** CRM Lead.sourceLine this line is tagged with (src/lib/source-line.ts). */
  sourceLine: "Main-API" | "Shoyab-GMB";
  locality: string;
  postalCode: string;
  streetAddress: string | null;
  /** From the live Google Business Profile (read from Google Maps 2026-11-01). */
  geo?: { latitude: number; longitude: number };
  mapsUrl?: string;
  plusCode?: string;
  /** Public GBP rating for this listing — keep in step with the live profile. */
  rating?: { value: string; count: number };
};

export const BRANCHES: Record<BranchKey, Branch> = {
  magarpatta: {
    key: "magarpatta",
    name: "Sahara Cleaning Services — Magarpatta City",
    gmbName: "Sahara Cleaning Services (Magarpatta)",
    phone: "7083347130",
    altPhones: [],
    bookOnlineUrl: "https://booking.saharacleaningservices.com?utm_source=gmb&utm_medium=magarpatta_branch&utm_campaign=gmb_book_online",
    whatsapp: "9175220270",
    sourceLine: "Main-API",
    locality: "Magarpatta City, Hadapsar",
    postalCode: "411028",
    streetAddress: "Opposite South Gate, Magarpatta City, Hadapsar",
  },
  mohammadwadi: {
    key: "mohammadwadi",
    name: "Sahara Cleaning Services — Mohammadwadi",
    gmbName: "Sahara Cleaning Services (Mohammadwadi)",
    phone: "8956567130",
    altPhones: ["7083347130"],
    bookOnlineUrl: "https://booking.saharacleaningservices.com?utm_source=gmb&utm_medium=mohammadwadi_branch&utm_campaign=gmb_book_online",
    whatsapp: "7083347130",
    sourceLine: "Shoyab-GMB",
    locality: "Mohammadwadi",
    postalCode: "411060",
    streetAddress: "Mohammad Wadi Rd, Sahakarnagar No - 2, Anand Nagar, Hadapsar",
    geo: { latitude: 18.4754638, longitude: 73.924633 },
    // Clean place URL of the owner's Mohammadwadi listing (tracking parameters removed).
    mapsUrl: "https://www.google.com/maps/place/Sahara+Cleaning+Services+in+Pune/@18.4754638,73.924633,17z/data=!3m1!4b1!4m6!3m5!1s0x3bc2eb84538b59cd:0xbcd9dadf0443ecba!8m2!3d18.4754638!4d73.924633",
    plusCode: "FWGF+5V Pune, Maharashtra",
    rating: { value: "4.8", count: 234 },
  },
};

export const ZONES: Record<ZoneKey, { slug: string; label: string; branch: BranchKey; focus: string }> = {
  east: { slug: "east-pune", label: "East Pune", branch: "magarpatta", focus: "IT parks, townships, large societies and business hubs" },
  "west-pcmc": { slug: "west-pune-pcmc", label: "West Pune & PCMC", branch: "mohammadwadi", focus: "the Hinjewadi–Baner–Wakad IT corridor, high-rise societies and Pimpri-Chinchwad industry" },
  north: { slug: "north-pune", label: "North Pune", branch: "magarpatta", focus: "airport-side offices, restaurants, boutique premises and premium apartments" },
  "south-central": { slug: "south-central-pune", label: "South & Central Pune", branch: "mohammadwadi", focus: "apartment societies, bungalows, clinics, shops and commercial premises" },
};

export type Locality = {
  slug: string;
  name: string;
  zone: ZoneKey;
  pins: string[];
  /** Short, factual description of the premises Sahara is asked to serve here. */
  premises: string;
  /** Named IT parks / townships / landmarks inside or beside the locality (owner list 2026-11-01). */
  landmarks: string[];
  /** Neighbouring locality slugs for internal links. */
  near: string[];
};

export const LOCALITIES: Locality[] = [
  // ── East ──────────────────────────────────────────────────────────────
  { slug: "magarpatta", name: "Magarpatta City", zone: "east", pins: ["411028"], premises: "township apartments, offices and IT campuses", landmarks: ["Cybercity Magarpatta", "Magarpatta City township", "Amanora Park Town"], near: ["hadapsar", "mundhwa", "phursungi"] },
  { slug: "hadapsar", name: "Hadapsar", zone: "east", pins: ["411028", "411013"], premises: "offices, industrial estates and apartment societies", landmarks: ["Amanora Park Town", "Hadapsar Industrial Estate", "Magarpatta City"], near: ["magarpatta", "phursungi", "manjri"] },
  { slug: "kharadi", name: "Kharadi", zone: "east", pins: ["411014"], premises: "IT parks, corporate offices and new high-rise societies", landmarks: ["EON IT Park Kharadi", "World Trade Center Pune", "Commerzone Kharadi"], near: ["viman-nagar", "mundhwa", "wagholi"] },
  { slug: "mundhwa", name: "Mundhwa", zone: "east", pins: ["411036"], premises: "offices, restaurants, apartment societies and commercial units", landmarks: ["Koregaon Park Annexe", "Kharadi Bypass", "Magarpatta City"], near: ["magarpatta", "kharadi", "koregaon-park"] },
  { slug: "manjri", name: "Manjri", zone: "east", pins: ["412307"], premises: "new housing societies, villas and commercial units", landmarks: ["Manjri Greens", "Serum Institute area"], near: ["hadapsar", "phursungi", "magarpatta"] },
  { slug: "wagholi", name: "Wagholi", zone: "east", pins: ["412207"], premises: "new housing societies, warehouses and commercial units", landmarks: ["Wagholi–Kesnand Road", "Lohegaon side warehouses"], near: ["kharadi", "dhanori", "viman-nagar"] },
  { slug: "phursungi", name: "Phursungi", zone: "east", pins: ["412308"], premises: "residential societies, warehouses and light-industrial units", landmarks: ["Pune–Solapur Road", "Fursungi industrial belt"], near: ["hadapsar", "manjri", "undri"] },
  // ── West & PCMC ───────────────────────────────────────────────────────
  { slug: "wakad", name: "Wakad", zone: "west-pcmc", pins: ["411057"], premises: "high-rise societies and IT-corridor offices", landmarks: ["Hinjewadi Phase 1", "Wakad–Hinjewadi Road", "Datta Mandir Road"], near: ["hinjewadi", "baner", "pimple-saudagar"] },
  { slug: "baner", name: "Baner", zone: "west-pcmc", pins: ["411045"], premises: "apartment societies, offices and showrooms", landmarks: ["Baner Road", "Balewadi High Street", "Pan Card Club Road"], near: ["balewadi", "aundh", "pashan"] },
  { slug: "balewadi", name: "Balewadi", zone: "west-pcmc", pins: ["411045"], premises: "premium apartments, offices and restaurants", landmarks: ["Balewadi High Street", "Balewadi Stadium", "Sus Road junction"], near: ["baner", "wakad", "sus"] },
  { slug: "hinjewadi", name: "Hinjewadi", zone: "west-pcmc", pins: ["411057"], premises: "IT parks, corporate offices and apartment societies", landmarks: ["Rajiv Gandhi Infotech Park Phase 1", "Hinjewadi Phase 2", "Hinjewadi Phase 3"], near: ["wakad", "baner", "balewadi"] },
  { slug: "sus", name: "Sus", zone: "west-pcmc", pins: ["411021"], premises: "villas, apartment societies and farmhouses", landmarks: ["Sus Road", "Mulshi Road"], near: ["pashan", "baner", "bavdhan"] },
  { slug: "pashan", name: "Pashan", zone: "west-pcmc", pins: ["411021", "411008"], premises: "apartments, bungalows and research-institute campuses", landmarks: ["Pashan–Sus Road", "NCL Pashan", "Pashan Lake"], near: ["sus", "baner", "bavdhan"] },
  { slug: "sutarwadi", name: "Sutarwadi", zone: "west-pcmc", pins: ["411021"], premises: "compact apartment societies and bungalows", landmarks: ["Sutarwadi Road", "Pashan–Sutarwadi link"], near: ["pashan", "sus", "baner"] },
  { slug: "aundh", name: "Aundh", zone: "west-pcmc", pins: ["411007"], premises: "apartments, bungalows and offices", landmarks: ["Aundh ITI Road", "Parihar Chowk", "Spicer College side"], near: ["baner", "pimple-nilakh", "kothrud"] },
  { slug: "pimple-saudagar", name: "Pimple Saudagar", zone: "west-pcmc", pins: ["411027"], premises: "high-rise societies and retail premises", landmarks: ["Kunal Icon Road", "Pimple Saudagar–Wakad link"], near: ["wakad", "pimple-nilakh", "pimpri"] },
  { slug: "pimple-nilakh", name: "Pimple Nilakh", zone: "west-pcmc", pins: ["411027"], premises: "premium apartment societies and villas", landmarks: ["Pimple Nilakh–Vishal Nagar", "Aundh–Ravet BRTS"], near: ["pimple-saudagar", "aundh", "wakad"] },
  { slug: "bavdhan", name: "Bavdhan", zone: "west-pcmc", pins: ["411021"], premises: "hill-side societies, bungalows and clinics", landmarks: ["Chandani Chowk", "Bavdhan Khurd"], near: ["kothrud", "pashan", "sus"] },
  { slug: "pimpri", name: "Pimpri", zone: "west-pcmc", pins: ["411018"], premises: "shops, offices, factories and residential complexes", landmarks: ["Pimpri market", "Pimpri–Chinchwad Link Road"], near: ["chinchwad", "pimple-saudagar", "bhosari"] },
  { slug: "chinchwad", name: "Chinchwad", zone: "west-pcmc", pins: ["411019", "411033"], premises: "factories, warehouses, offices and residential complexes", landmarks: ["Chinchwad MIDC", "Chinchwad Station Road"], near: ["pimpri", "bhosari", "pimple-saudagar"] },
  { slug: "bhosari", name: "Bhosari", zone: "west-pcmc", pins: ["411039"], premises: "industrial units, warehouses and workshops", landmarks: ["Bhosari MIDC", "Pune–Nashik Highway"], near: ["chinchwad", "pimpri", "dhanori"] },
  // ── North ─────────────────────────────────────────────────────────────
  { slug: "viman-nagar", name: "Viman Nagar", zone: "north", pins: ["411014"], premises: "offices, retail and apartment buildings", landmarks: ["Phoenix Marketcity Viman Nagar", "Nagar Road", "Symbiosis Viman Nagar"], near: ["kalyani-nagar", "kharadi", "yerwada"] },
  { slug: "kalyani-nagar", name: "Kalyani Nagar", zone: "north", pins: ["411006"], premises: "offices, apartments, cafes and retail", landmarks: ["Kalyani Nagar Metro side", "Pune Airport Road"], near: ["viman-nagar", "yerwada", "koregaon-park"] },
  { slug: "koregaon-park", name: "Koregaon Park", zone: "north", pins: ["411001"], premises: "apartments, offices, restaurants and boutique premises", landmarks: ["North Main Road", "Lane 5–7"], near: ["kalyani-nagar", "mundhwa", "camp"] },
  { slug: "yerwada", name: "Yerwada", zone: "north", pins: ["411006"], premises: "apartments, institutions and commercial premises", landmarks: ["Yerwada Gunjan Chowk", "Nagar Road side"], near: ["kalyani-nagar", "viman-nagar", "vishrantwadi"] },
  { slug: "dhanori", name: "Dhanori", zone: "north", pins: ["411015"], premises: "new societies, villas and commercial units", landmarks: ["Dhanori–Lohegaon Road", "Alandi Road"], near: ["vishrantwadi", "wagholi", "yerwada"] },
  { slug: "vishrantwadi", name: "Vishrantwadi", zone: "north", pins: ["411015"], premises: "apartment societies, shops and clinics", landmarks: ["Alandi Road", "Tingre Nagar"], near: ["dhanori", "yerwada", "viman-nagar"] },
  // ── South & Central ───────────────────────────────────────────────────
  { slug: "nibm", name: "NIBM Road", zone: "south-central", pins: ["411048"], premises: "apartment societies, bungalows and small offices", landmarks: ["NIBM Annexe", "Corinthian Club side"], near: ["kondhwa", "undri", "wanowrie"] },
  { slug: "kondhwa", name: "Kondhwa", zone: "south-central", pins: ["411048"], premises: "residential societies and commercial premises", landmarks: ["Kondhwa Khurd", "Salunke Vihar Road"], near: ["nibm", "mohammadwadi", "undri"] },
  { slug: "wanowrie", name: "Wanowrie", zone: "south-central", pins: ["411040"], premises: "apartments, bungalows and retail premises", landmarks: ["Fatima Nagar Chowk", "Wanowrie Bazaar"], near: ["camp", "nibm", "kondhwa"] },
  { slug: "undri", name: "Undri", zone: "south-central", pins: ["411060"], premises: "residential societies and bungalow communities", landmarks: ["Undri Chowk", "Pisoli side"], near: ["mohammadwadi", "nibm", "kondhwa"] },
  { slug: "mohammadwadi", name: "Mohammadwadi", zone: "south-central", pins: ["411060"], premises: "apartment societies, bungalows and local commercial premises", landmarks: ["Mohammadwadi Road", "Undri–Mohammadwadi link"], near: ["undri", "kondhwa", "nibm"] },
  { slug: "katraj", name: "Katraj", zone: "south-central", pins: ["411046"], premises: "residential societies, shops and clinics", landmarks: ["Katraj Chowk", "Pune–Satara Road"], near: ["dhankawadi", "balaji-nagar", "kondhwa"] },
  { slug: "dhankawadi", name: "Dhankawadi", zone: "south-central", pins: ["411043"], premises: "apartment societies, shops and commercial premises", landmarks: ["Dhankawadi Chowk", "Pune–Satara Road"], near: ["katraj", "bibwewadi", "balaji-nagar"] },
  { slug: "bibwewadi", name: "Bibwewadi", zone: "south-central", pins: ["411037"], premises: "apartments, clinics and retail premises", landmarks: ["Bibwewadi Chowk", "Upper Indira Nagar"], near: ["balaji-nagar", "dhankawadi", "camp"] },
  { slug: "balaji-nagar", name: "Balaji Nagar", zone: "south-central", pins: ["411043"], premises: "residential societies and small commercial premises", landmarks: ["Balaji Nagar Chowk", "Katraj–Dhankawadi side"], near: ["bibwewadi", "dhankawadi", "katraj"] },
  { slug: "kothrud", name: "Kothrud", zone: "south-central", pins: ["411038"], premises: "apartments, bungalows, clinics and offices", landmarks: ["Karve Road", "Paud Road", "Kothrud Depot"], near: ["bavdhan", "aundh", "shivajinagar"] },
  { slug: "shivajinagar", name: "Shivajinagar", zone: "south-central", pins: ["411005"], premises: "offices, institutions, retail and apartments", landmarks: ["FC Road", "JM Road", "Pune University side"], near: ["kothrud", "camp", "aundh"] },
  { slug: "camp", name: "Camp (Pune Cantonment)", zone: "south-central", pins: ["411001", "411040"], premises: "heritage buildings, offices, restaurants and retail", landmarks: ["MG Road", "East Street", "Pune Cantonment"], near: ["wanowrie", "koregaon-park", "shivajinagar"] },
];

export const localityBySlug = (slug: string) => LOCALITIES.find((l) => l.slug === slug);

/** Major IT parks and premium townships (owner list) — used as hyper-local proof points and in the corporate / architect portals. */
export const IT_PARKS = [
  { name: "EON IT Park", area: "Kharadi", locality: "kharadi" },
  { name: "Hinjewadi Phase 1–3 (Rajiv Gandhi Infotech Park)", area: "Hinjewadi", locality: "hinjewadi" },
  { name: "Cybercity Magarpatta", area: "Magarpatta City", locality: "magarpatta" },
  { name: "Commerzone", area: "Kharadi / Yerwada", locality: "kharadi" },
] as const;

export const TOWNSHIPS = [
  { name: "Amanora Park Town", area: "Hadapsar", locality: "hadapsar" },
  { name: "Magarpatta City", area: "Hadapsar", locality: "magarpatta" },
  { name: "Megapolis", area: "Hinjewadi", locality: "hinjewadi" },
  { name: "Nyati", area: "Pune (Undri / Kharadi / Wagholi projects)", locality: "undri" },
  { name: "Trump Towers", area: "Kalyani Nagar", locality: "kalyani-nagar" },
] as const;

/** Pin code → locality names. Superset of the pins used above, 411001–411062 + outskirts the owner listed. */
export const PIN_INDEX: Record<string, string[]> = LOCALITIES.reduce<Record<string, string[]>>((acc, l) => {
  for (const p of l.pins) (acc[p] ??= []).push(l.name);
  return acc;
}, {});
export const ALL_PINS = Object.keys(PIN_INDEX).sort();

// ── Services ─────────────────────────────────────────────────────────────
export type VerticalKey = "residential" | "commercial" | "post-interior" | "pest" | "painting";

export const VERTICALS: Record<VerticalKey, { label: string; crm: "HOME_DEEP_CLEANING" | "COMMERCIAL_CLEANING" | "HOUSEKEEPING" | "PEST_CONTROL" | "PAINTING"; corePath: string }> = {
  residential: { label: "Residential & Deep Cleaning", crm: "HOME_DEEP_CLEANING", corePath: "/home-deep-cleaning-pune" },
  commercial: { label: "Commercial & Corporate Facility Management", crm: "COMMERCIAL_CLEANING", corePath: "/commercial-cleaning-pune" },
  "post-interior": { label: "Post-Interior Deep Cleaning", crm: "HOME_DEEP_CLEANING", corePath: "/commercial-cleaning-pune" },
  pest: { label: "Pest Control", crm: "PEST_CONTROL", corePath: "/pest-control-pune" },
  painting: { label: "Interior & Exterior Painting", crm: "PAINTING", corePath: "/interior-painting-pune" },
};

export type ServiceCategory = {
  slug: string;
  vertical: VerticalKey;
  name: string; // "Home Deep Cleaning"
  short: string; // phrase used in titles: "Home Deep Cleaning"
  keyword: string; // primary search phrase (lower-case) — "home deep cleaning"
  intro: string; // one factual sentence, no prices
  includes: string[];
  audience: string; // who typically books it
  typeLabel: string;
  typeOptions: string[];
  faq: (loc: string) => { q: string; a: string }[];
};

const SITE_VISIT = "Sahara quotes in writing before work starts.";

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    slug: "home-deep-cleaning", vertical: "residential", name: "Home Deep Cleaning", short: "Home Deep Cleaning", keyword: "home deep cleaning",
    intro: "Room-by-room deep cleaning of flats, villas and bungalows by trained in-house staff using machines and professional chemicals.",
    includes: ["Kitchen degreasing and cabinet cleaning", "Bathroom descaling and tile-grout cleaning", "Window, glass and balcony cleaning", "Floor scrubbing and polishing", "Fans, lights, switchboards and wall-spot cleaning"],
    audience: "families, tenants and owners preparing for a festival, move-in or move-out",
    typeLabel: "Home size", typeOptions: ["1 BHK", "2 BHK", "3 BHK", "4 BHK / Villa / Bungalow", "Not sure"],
    faq: (l) => [
      { q: `How long does home deep cleaning take in ${l}?`, a: "A typical 2 BHK is done in one day with a small crew; larger homes and villas take longer. The team lead confirms the schedule when you book." },
      { q: "Do I need to arrange water, power or equipment?", a: "Please keep water and power available. Sahara brings the machines, tools and chemicals." },
    ],
  },
  {
    slug: "sofa-carpet-mattress-cleaning", vertical: "residential", name: "Sofa, Carpet & Mattress Cleaning", short: "Sofa, Carpet & Mattress Cleaning", keyword: "sofa carpet mattress cleaning",
    intro: "Shampoo and extraction cleaning for fabric sofas, carpets and mattresses with fast-drying methods.",
    includes: ["Sofa shampooing and stain treatment", "Carpet shampooing and extraction", "Mattress vacuuming and sanitising", "Dust-mite and odour treatment", "Dining chair and curtain cleaning on request"],
    audience: "households with children, pets or allergies and offices with upholstered seating",
    typeLabel: "Item", typeOptions: ["Sofa", "Carpet", "Mattress", "Sofa + Carpet + Mattress", "Not sure"],
    faq: (l) => [
      { q: `Do you clean sofas at home in ${l}?`, a: "Yes. The crew cleans on site so nothing needs to be moved out of your home or office." },
      { q: "Will old stains definitely come out?", a: "Most routine stains lift well; very old stains, dye transfer or discolouration cannot be guaranteed and are explained before work." },
    ],
  },
  {
    slug: "kitchen-bathroom-cleaning", vertical: "residential", name: "Kitchen & Bathroom Deep Cleaning", short: "Kitchen & Bathroom Cleaning", keyword: "kitchen and bathroom deep cleaning",
    intro: "Degreasing, descaling and sanitising for kitchens and bathrooms, including chimney exteriors, tiles, fittings and drains.",
    includes: ["Chimney, hob and cabinet exterior degreasing", "Tile and grout scrubbing", "Hard-water stain and limescale removal", "Sink, tap and fitting polishing", "Drain and floor-trap cleaning"],
    audience: "homes with heavy cooking use or hard-water staining",
    typeLabel: "Area", typeOptions: ["Kitchen", "Bathroom(s)", "Kitchen + Bathroom(s)", "Not sure"],
    faq: (l) => [
      { q: `Can I book only the kitchen or bathroom in ${l}?`, a: "Yes. You can book a single kitchen, one or more bathrooms, or add them to a full home deep clean." },
      { q: "Do you clean inside the cabinets?", a: "Cabinet interiors are cleaned when they are emptied before the visit; exteriors are always included." },
    ],
  },
  {
    slug: "window-floor-cleaning", vertical: "residential", name: "Window & Floor Scrubbing", short: "Window & Floor Cleaning", keyword: "window and floor cleaning",
    intro: "Machine floor scrubbing and polishing with window, glass and track cleaning for homes and small premises.",
    includes: ["Single-disc machine floor scrubbing", "Marble, vitrified and tile floor care", "Window glass, frame and track cleaning", "Balcony and grill cleaning", "Stain and cement-patch treatment where possible"],
    audience: "owners of apartments, bungalows and small shops",
    typeLabel: "Service", typeOptions: ["Floor scrubbing", "Window / glass cleaning", "Both", "Not sure"],
    faq: (l) => [
      { q: `Do you do window cleaning in high-rise flats in ${l}?`, a: "Interior-side and balcony-reachable glass is covered. External high-rise facade work needs a site visit for the safety method." },
      { q: "Can floors be polished as well as scrubbed?", a: "Yes. The scope depends on the floor type and is confirmed before work." },
    ],
  },
  {
    slug: "office-cleaning-housekeeping", vertical: "commercial", name: "Office Cleaning & Housekeeping", short: "Office Cleaning & Housekeeping", keyword: "office cleaning and housekeeping",
    intro: "Daily housekeeping, office boys and periodic deep cleaning for offices, planned around your working hours.",
    includes: ["Shift-wise housekeeping staff and office boys", "Workstation, pantry and washroom cleaning", "Carpet and upholstery cleaning", "Machine scrubbing of common areas", "Supervisor and attendance reporting"],
    audience: "offices, IT companies, co-working spaces and clinics",
    typeLabel: "Facility type", typeOptions: ["Office / IT park", "Co-working / startup", "Clinic / hospital", "Retail / showroom", "Other"],
    faq: (l) => [
      { q: `Can you provide housekeeping staff for an office in ${l}?`, a: `Yes. Sahara supplies trained housekeeping staff and office boys on a daily or contract basis. ${SITE_VISIT}` },
      { q: "Can cleaning be done after office hours?", a: "Yes. Night, early-morning and weekend schedules are common for offices." },
    ],
  },
  {
    slug: "facility-management", vertical: "commercial", name: "Facility Management & Security Manpower", short: "Facility Management (AMC)", keyword: "facility management services",
    intro: "Housekeeping, security guards and support manpower under one annual maintenance contract (AMC) for offices, societies and commercial complexes.",
    includes: ["Housekeeping and office-boy manpower", "Security guard manpower", "Common-area, washroom and terrace upkeep", "Periodic deep cleaning and pest-control bundling", "Monthly invoicing with GST"],
    audience: "corporate offices, housing societies, malls and commercial complexes",
    typeLabel: "Facility type", typeOptions: ["Office / IT park", "Society / residential complex", "Mall / commercial complex", "Industrial / warehouse", "Other"],
    faq: (l) => [
      { q: `Do you offer facility management AMC in ${l}?`, a: `Yes, for offices, societies and commercial complexes. The scope and manpower are agreed at a site visit. ${SITE_VISIT}` },
      { q: "Is GST invoicing available?", a: "Yes. Sahara is GST registered and issues GST invoices for corporate and society contracts." },
    ],
  },
  {
    slug: "industrial-showroom-facade-cleaning", vertical: "commercial", name: "Showroom, Mall, Hospital, Industrial & Facade Cleaning", short: "Showroom, Industrial & Facade Cleaning", keyword: "showroom industrial and facade cleaning",
    intro: "Machine cleaning for showrooms, malls, hospitals, factories, warehouses and glass facades, scheduled to avoid disruption.",
    includes: ["Ride-on and walk-behind floor scrubbing", "Showroom glass and display cleaning", "Hospital-grade surface sanitising", "Warehouse and factory floor degreasing", "Glass and facade cleaning with a safety method"],
    audience: "showrooms, malls, hospitals, factories and warehouses",
    typeLabel: "Premises", typeOptions: ["Showroom / retail", "Mall", "Hospital / clinic", "Factory / warehouse", "Glass facade", "Other"],
    faq: (l) => [
      { q: `Do you clean factories and warehouses near ${l}?`, a: "Yes, with machines suited to the floor type. A site visit fixes the scope, schedule and safety method." },
      { q: "Is facade cleaning done with proper safety?", a: "Facade work is scoped at a site visit so the access method and safety measures are agreed in writing first." },
    ],
  },
  {
    slug: "post-interior-cleaning", vertical: "post-interior", name: "Post-Interior & Post-Construction Cleaning", short: "Post-Interior Cleaning", keyword: "post interior cleaning",
    intro: "Dust, putty, paint-splash and cement removal after interior work, so the site is ready for handover or move-in.",
    includes: ["Fine-dust removal from walls, ceilings and fixtures", "Paint, putty and cement-splash removal", "Glass, frame and channel cleaning", "Modular kitchen and wardrobe cleaning", "Final handover-ready floor scrubbing"],
    audience: "architects, interior designers, contractors and home owners finishing renovation",
    typeLabel: "Site", typeOptions: ["Home (1–2 BHK)", "Home (3 BHK+) / Villa", "Office fit-out", "Showroom / retail fit-out", "Other"],
    faq: (l) => [
      { q: `Do you work with architects and interior designers in ${l}?`, a: "Yes. Sahara handles post-interior and post-renovation cleaning for design studios and contractors, with a clear scope and schedule per site." },
      { q: "When should post-interior cleaning be booked?", a: "After carpentry, painting and fixtures are finished and before handover or move-in. Book a day or two ahead so the crew fits your handover date." },
    ],
  },
  {
    slug: "pest-control", vertical: "pest", name: "Pest Control Services", short: "Pest Control", keyword: "pest control",
    intro: "Inspection-led treatment for cockroaches, termites, bed bugs, ants and rodents in homes, offices and societies.",
    includes: ["Cockroach gel and spray treatment", "Termite drill-fill and soil treatment", "Bed bug treatment", "Rodent control", "Annual contracts for offices and societies"],
    audience: "homes, restaurants, offices and housing societies",
    typeLabel: "Pest", typeOptions: ["Cockroach / ants", "Termite", "Bed bugs", "Rodent", "Not sure"],
    faq: (l) => [
      { q: `Do you offer pest control in ${l}?`, a: "Yes — cockroach, termite, bed bug, ant and rodent control for homes, commercial premises and societies, after an inspection." },
      { q: "Is the treatment safe for children and pets?", a: "The crew explains which areas to keep clear and for how long after treatment. Please tell the team about children, pets or aquariums when booking." },
    ],
  },
  {
    slug: "interior-painting", vertical: "painting", name: "Interior Painting", short: "Interior Painting", keyword: "interior painting",
    intro: "Dust-controlled interior painting with surface preparation, putty, primer and finishing coats, quoted after a free site measurement.",
    includes: ["Furniture covering and dust control", "Putty, sanding and primer", "Emulsion and texture finishes", "Ceiling and wood-polish touch-ups", "Post-paint cleaning"],
    audience: "home owners, tenants repainting before handover and offices",
    typeLabel: "Property", typeOptions: ["1–2 BHK", "3 BHK+", "Villa / Bungalow", "Office / shop", "Other"],
    faq: (l) => [
      { q: `Is the site visit for painting in ${l} free?`, a: "Yes. We inspect, measure and share a written quote based on area, paint choice and surface condition." },
      { q: "Do you cover furniture and clean up after painting?", a: "Yes. Furniture is covered before work and the site is cleaned when the job is finished." },
    ],
  },
  {
    slug: "exterior-painting", vertical: "painting", name: "Exterior, Society & Commercial Painting", short: "Exterior & Society Painting", keyword: "exterior painting",
    intro: "Weather-resistant exterior painting for bungalows, housing societies and commercial buildings, quoted after a free site measurement.",
    includes: ["Surface preparation and crack filling", "Weather-resistant exterior emulsion and texture", "Scaffolding or safe access arrangement", "Society and commercial building schedules", "Post-work cleaning"],
    audience: "housing societies, bungalow owners, offices and commercial buildings",
    typeLabel: "Property", typeOptions: ["Bungalow / Villa", "Housing society", "Office / commercial building", "Factory / warehouse", "Other"],
    faq: (l) => [
      { q: `Do you paint housing society buildings in ${l}?`, a: "Yes. Society and commercial painting is scoped at a site visit — area, access method, paint system and schedule are agreed in writing." },
      { q: "How is exterior painting priced?", a: "By measured area, paint system and access requirements, quoted in writing after the site visit." },
    ],
  },
];

export const categoryBySlug = (slug: string) => SERVICE_CATEGORIES.find((c) => c.slug === slug);

export const seoPagePath = (category: string, location: string) => `/services/${category}/${location}`;

/** Every programmatic landing page (category × locality). */
export const PROGRAMMATIC_PAGES = SERVICE_CATEGORIES.flatMap((c) => LOCALITIES.map((l) => ({ category: c.slug, location: l.slug })));

export const branchForLocality = (l: Locality): Branch => BRANCHES[ZONES[l.zone].branch];

/** Pre-filled WhatsApp text: area, PIN, service vertical and branch — read by staff and by the CRM lead notes. */
export function whatsappTextFor(c: ServiceCategory, l: Locality): string {
  const b = branchForLocality(l);
  return `Hi Sahara, I need ${c.name} in ${l.name}, Pune (${l.pins[0]}). Branch: ${b.locality}. Ref: ${c.vertical}/${c.slug}/${l.slug}`;
}

// ── Legacy URLs (SEO protection) ──────────────────────────────────────────
// Every URL below already ranks / is linked from Google, WhatsApp campaigns or the old WordPress site and MUST keep working.
// The navigation mega-menu (src/config/nav-menu.ts) only rearranges how links are shown — it never removes or renames a route.
// Tests (tests/nav-menu.test.ts) fail if a menu link points at a path that is neither here nor a /services/<category> page.
export const LEGACY_PATHS = [
  "/home-deep-cleaning-pune", "/residential-cleaning", "/commercial-cleaning", "/commercial-cleaning-pune", "/housekeeping-services",
  "/pest-control", "/pest-control-pune", "/interior-painting-pune", "/painting-services", "/offers", "/booking", "/gallery", "/contact",
] as const;
