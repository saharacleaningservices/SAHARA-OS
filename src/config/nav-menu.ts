import { SERVICE_CATEGORIES, LEGACY_PATHS } from "@/config/pune-seo-matrix";

// Header mega-menu structure (owner 2026-11-01). Presentation only — every link points at a route that already exists
// (a /services/<category> hub or a legacy path kept in pune-seo-matrix.ts LEGACY_PATHS), so no ranking URL is lost or renamed.
export type NavLeaf = { label: string; href: string };
export type NavPillar = { title: string; blurb: string; href: string; items: NavLeaf[] };
export type NavMega = { id: "residential" | "commercial"; label: string; pillars: NavPillar[] };

const svc = (slug: string) => `/services/${slug}`;

export const NAV_MEGA: NavMega[] = [
  {
    id: "residential",
    label: "Residential Services",
    pillars: [
      { title: "Home Deep Cleaning", blurb: "Whole-home deep clean for any BHK", href: "/home-deep-cleaning-pune", items: [
        { label: "Furnished Home", href: "/home-deep-cleaning-pune" },
        { label: "Unfurnished Home", href: "/home-deep-cleaning-pune" },
        { label: "Move-In / Move-Out", href: svc("home-deep-cleaning") },
        { label: "Post-Interior Site Inspection", href: svc("post-interior-cleaning") },
      ] },
      { title: "Individual Cleaning Services", blurb: "Only the area you need", href: svc("kitchen-bathroom-cleaning"), items: [
        { label: "Kitchen Cleaning", href: svc("kitchen-bathroom-cleaning") },
        { label: "Bathroom Cleaning", href: svc("kitchen-bathroom-cleaning") },
        { label: "Sofa & Shampooing", href: svc("sofa-carpet-mattress-cleaning") },
        { label: "Mattress Cleaning", href: svc("sofa-carpet-mattress-cleaning") },
        { label: "Carpet Cleaning", href: svc("sofa-carpet-mattress-cleaning") },
      ] },
      { title: "Pest Control", blurb: "Safe treatments for homes", href: "/pest-control-pune", items: [
        { label: "Bed Bugs", href: svc("pest-control") },
        { label: "Cockroach & Ant", href: svc("pest-control") },
        { label: "Rodent", href: svc("pest-control") },
        { label: "Termite", href: svc("pest-control") },
      ] },
      { title: "Painting Services", blurb: "Free site inspection first", href: "/painting-services", items: [
        { label: "Interior — Asian Paints Royal / Luster / Premium / Tractor Emulsion", href: "/interior-painting-pune" },
        { label: "Exterior Painting", href: svc("exterior-painting") },
        { label: "Rental Express Painting", href: "/painting-services" },
      ] },
    ],
  },
  {
    id: "commercial",
    label: "Commercial Services",
    pillars: [
      { title: "Commercial Deep Cleaning", blurb: "One-time deep clean for business premises", href: "/commercial-cleaning-pune", items: [
        { label: "Corporate Offices", href: svc("office-cleaning-housekeeping") },
        { label: "Warehouses", href: svc("industrial-showroom-facade-cleaning") },
        { label: "Showrooms", href: svc("industrial-showroom-facade-cleaning") },
        { label: "Hospitals", href: svc("office-cleaning-housekeeping") },
        { label: "Restaurants", href: svc("office-cleaning-housekeeping") },
        { label: "Façade & Glass", href: svc("industrial-showroom-facade-cleaning") },
        { label: "Turnkey Post-Construction", href: svc("post-interior-cleaning") },
      ] },
      { title: "Housekeeping Services & AMC", blurb: "Daily staff and annual contracts", href: "/housekeeping-services", items: [
        { label: "Co-Op Societies", href: "/housekeeping-services" },
        { label: "Daily Office Housekeeping", href: svc("office-cleaning-housekeeping") },
        { label: "Showrooms", href: "/housekeeping-services" },
        { label: "Hospitals", href: "/housekeeping-services" },
        { label: "Malls", href: "/housekeeping-services" },
      ] },
      { title: "Commercial Pest Control", blurb: "Compliance-friendly pest management", href: svc("pest-control"), items: [
        { label: "Offices", href: svc("pest-control") },
        { label: "Restaurants", href: svc("pest-control") },
        { label: "Warehouses", href: svc("pest-control") },
        { label: "Society AMC", href: svc("pest-control") },
      ] },
      { title: "Commercial Painting", blurb: "Interior & exterior, quoted on site", href: svc("exterior-painting"), items: [
        { label: "Corporate Offices", href: svc("interior-painting") },
        { label: "Retail Malls", href: svc("exterior-painting") },
        { label: "Industrial Warehouses", href: svc("exterior-painting") },
        { label: "Hospitals & Hotels", href: svc("interior-painting") },
      ] },
      { title: "Facility Management Solutions", blurb: "Soft services under one contract", href: svc("facility-management"), items: [
        { label: "Soft Services", href: svc("facility-management") },
        { label: "Office / Pantry Boys", href: svc("facility-management") },
        { label: "Security Guard Staffing", href: svc("facility-management") },
        { label: "Support Staff", href: svc("facility-management") },
      ] },
    ],
  },
];

/** All distinct hrefs the menu can emit — used by tests to prove no menu link points at a missing route. */
export const NAV_HREFS = Array.from(new Set(NAV_MEGA.flatMap((m) => m.pillars.flatMap((p) => [p.href, ...p.items.map((i) => i.href)]))));

export const isKnownNavHref = (href: string) =>
  (LEGACY_PATHS as readonly string[]).includes(href) || SERVICE_CATEGORIES.some((c) => href === `/services/${c.slug}`);
