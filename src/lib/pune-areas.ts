// Pune sub-markets for the area landing pages (/pune and /pune/<slug>). Facts only: each page describes the kind of
// premises Sahara is asked to serve in that part of Pune and links to the five service pages. No prices, no ratings,
// no "best" claims, no invented client counts (same rules as src/lib/seo-schema.ts).

export type AreaCluster = "east" | "west" | "pcmc" | "central";

export type PuneArea = { slug: string; name: string; cluster: AreaCluster; premises: string };

export const CLUSTERS: Record<AreaCluster, { label: string; focus: string }> = {
  east: { label: "East Pune", focus: "IT parks, business hubs, offices and large residential societies" },
  west: { label: "West Pune", focus: "IT corridor offices, high-rise societies and new apartment projects" },
  pcmc: { label: "Pimpri-Chinchwad (PCMC)", focus: "industrial units, warehouses, offices and residential complexes" },
  central: { label: "Central Pune", focus: "apartments, bungalows, clinics and commercial premises" },
};

export const PUNE_AREAS: PuneArea[] = [
  { slug: "magarpatta", name: "Magarpatta City", cluster: "east", premises: "townships, offices and IT campuses" },
  { slug: "hadapsar", name: "Hadapsar", cluster: "east", premises: "offices, industrial estates and apartment societies" },
  { slug: "kharadi", name: "Kharadi", cluster: "east", premises: "IT parks, corporate offices and new high-rise societies" },
  { slug: "viman-nagar", name: "Viman Nagar", cluster: "east", premises: "offices, retail and apartment buildings" },
  { slug: "wagholi", name: "Wagholi", cluster: "east", premises: "new housing societies, warehouses and commercial units" },
  { slug: "undri", name: "Undri", cluster: "east", premises: "residential societies and bungalow communities" },
  { slug: "nibm", name: "NIBM Road", cluster: "east", premises: "apartment societies, bungalows and small offices" },
  { slug: "kondhwa", name: "Kondhwa", cluster: "east", premises: "residential societies and commercial premises" },
  { slug: "koregaon-park", name: "Koregaon Park", cluster: "east", premises: "apartments, offices, restaurants and boutique premises" },
  { slug: "kalyani-nagar", name: "Kalyani Nagar", cluster: "east", premises: "offices, apartments and retail" },
  { slug: "baner", name: "Baner", cluster: "west", premises: "apartment societies, offices and showrooms" },
  { slug: "wakad", name: "Wakad", cluster: "west", premises: "high-rise societies and IT-corridor offices" },
  { slug: "hinjewadi", name: "Hinjewadi", cluster: "west", premises: "IT parks, corporate offices and apartment societies" },
  { slug: "aundh", name: "Aundh", cluster: "west", premises: "apartments, bungalows and offices" },
  { slug: "kothrud", name: "Kothrud", cluster: "central", premises: "apartments, bungalows, clinics and offices" },
  { slug: "pcmc", name: "Pimpri-Chinchwad (PCMC)", cluster: "pcmc", premises: "factories, warehouses, offices and residential complexes" },
];

export const areaBySlug = (slug: string) => PUNE_AREAS.find((a) => a.slug === slug);

/** The five service categories every area page links to (names match src/lib/seo-schema.ts). */
export const AREA_SERVICES = [
  { key: "home", name: "Home Deep Cleaning", path: "/home-deep-cleaning-pune", text: "Full-home deep cleaning, sofa, kitchen, bathroom, mattress and carpet cleaning with trained in-house staff." },
  { key: "office", name: "Commercial & Office Cleaning", path: "/commercial-cleaning-pune", text: "Office deep cleaning, machine scrubbing and carpet cleaning, scheduled outside working hours if you prefer. Written quote before work." },
  { key: "pest", name: "Pest Control Services", path: "/pest-control-pune", text: "Termite, cockroach, bed bug and ant treatment after an inspection." },
  { key: "paint", name: "Interior & Exterior Painting", path: "/interior-painting-pune", text: "Interior and texture painting with a free site inspection and a measurement-based quote." },
  { key: "fm", name: "Facility Management & Housekeeping (AMC)", path: "/housekeeping-services", text: "On-site housekeeping staff and annual maintenance contracts for offices, societies and commercial complexes, scoped at a site visit." },
] as const;
