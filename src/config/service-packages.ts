// Visual package cards for the individual-service pages (owner directive 2026-11-12): each priced service shows
// side-by-side cards with an Included and a Not included checklist, like the Full Home Premium / Platinum cards.
// NO price is written here — price, unit and minimum quantity come live from the pricing master by `contentId`.
// A service that has no entry below (or a contentId without a spec) falls back to the catalog service's own
// `includes` / default excludes (see packagesFor in components/public/catalog-blocks.tsx).

export type PackageSpec = {
  /** Pricing-master item this card books (server re-prices from it). */
  contentId: string;
  title: string;
  /** Ribbon text, e.g. MOST CONVENIENT. */
  badge?: string;
  included: string[];
  excluded: string[];
  /** Included lines shown bold + highlighted (what makes this card different). */
  highlight?: string[];
  /** Show the  − 1 +  quantity selector (per seat / bathroom / window …). */
  qty?: boolean;
};

const KITCHEN_COMMON = [
  "Platform & wall-tile degreasing",
  "Sink & tap descaling",
  "Exhaust fan & window cleaning",
  "Appliances exterior cleaning — Fridge, Microwave, Chimney & Stove exterior",
];
const KITCHEN_FLOOR = "Floor scrubbing & mopping";

export const SERVICE_PACKAGES: Record<string, PackageSpec[]> = {
  "kitchen-deep-cleaning": [
    {
      contentId: "SCS-12",
      title: "Standard",
      included: [...KITCHEN_COMMON, "Cabinet & trolley exterior + interior cleaning (you empty the cabinets)", KITCHEN_FLOOR],
      excluded: ["Appliances interior cleaning (available as add-ons)", "Utensil removal & placing back", "Moving heavy appliances"],
    },
    {
      contentId: "SCS-33",
      title: "With Utensil Removal",
      badge: "MOST CONVENIENT",
      included: [...KITCHEN_COMMON, "Cabinet & trolley exterior + interior cleaning", KITCHEN_FLOOR, "Our team removes all utensils, deep cleans cabinet/trolley interiors, and places everything back neatly"],
      highlight: ["Our team removes all utensils, deep cleans cabinet/trolley interiors, and places everything back neatly"],
      excluded: ["Appliances interior cleaning (available as add-ons)", "Moving heavy appliances"],
    },
  ],
  "bathroom-deep-cleaning": [
    {
      contentId: "SCS-10",
      title: "Bathroom Deep Cleaning",
      qty: true,
      included: ["Hard-water stain & scale removal", "Wall & floor tile grout scrubbing", "WC, basin & shower area", "Taps, fittings & mirrors", "Exhaust fan & door"],
      excluded: ["Plumbing or tile repairs", "Moving heavy fixtures", "Old permanent stains (no guarantee of full removal)"],
    },
  ],
  "sofa-upholstery-cleaning": [
    {
      contentId: "SCS-09",
      title: "Sofa Shampooing",
      qty: true,
      included: ["Dry vacuuming", "Shampoo pre-treatment of stains", "Machine wet extraction", "Fast-dry finish"],
      excluded: ["Old permanent stains (no guarantee of full removal)", "Moving heavy furniture", "Areas outside the booked sofa / chairs"],
    },
    {
      contentId: "SCS-11",
      title: "Mattress Cleaning",
      qty: true,
      included: ["Dry vacuuming", "Stain pre-treatment", "Machine extraction & fast-dry finish"],
      excluded: ["Old permanent stains (no guarantee of full removal)", "Moving heavy furniture"],
    },
  ],
  "carpet-cleaning": [
    {
      contentId: "SCS-13",
      title: "Carpet Shampooing",
      qty: true,
      included: ["Dry vacuuming", "Spot pre-treatment", "Shampoo & wet extraction", "Edge & pile grooming"],
      excluded: ["Old permanent stains (no guarantee of full removal)", "Moving heavy furniture off the carpet"],
    },
  ],
  "window-cleaning": [
    {
      contentId: "SCS-30",
      title: "Window Cleaning",
      qty: true,
      included: ["Window glass inside & outside where reachable", "Frame & grill cleaning", "Sliding-channel vacuuming", "Hard-water spot removal", "Mesh / net wipe-down"],
      excluded: ["High-rise exterior glass needing rope access (quoted as façade work)", "Unsafe or inaccessible heights"],
    },
  ],
  "balcony-cleaning": [
    {
      contentId: "SCS-34",
      title: "Balcony Cleaning",
      qty: true,
      included: ["Floor machine / manual scrubbing", "Drain outlet cleaning", "Railing & grill wipe-down", "Ledge & wall-tile cleaning", "Cobweb removal"],
      excluded: ["Moving heavy planters or furniture", "Inaccessible or unsafe heights"],
    },
  ],
};
