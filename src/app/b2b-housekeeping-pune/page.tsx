import type { Metadata } from "next";
import { BASE_URL } from "@/components/public/landing-kit";
import { B2bPage, type B2bConfig } from "@/components/public/b2b-page";

// Rendered per request like every other public page (Company Settings need the database, which the Docker build does not have).
export const dynamic = "force-dynamic";

const PATH = "/b2b-housekeeping-pune";
const TITLE = "B2B Housekeeping & Facility Services in Pune — Offices, IT Parks, Societies | Sahara";
const DESC = "Housekeeping contracts for Pune offices, IT parks, housing societies, hospitals and sites: trained in-house staff, post-construction handover cleaning, GST invoice. Pay after service. Site visit and written quote.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${BASE_URL}${PATH}` },
  robots: { index: true, follow: true },
  openGraph: { type: "website", url: `${BASE_URL}${PATH}`, title: TITLE, description: DESC, siteName: "Sahara Cleaning Services", locale: "en_IN" },
};

const CFG: B2bConfig = {
  path: PATH,
  vertical: "commercial",
  waIntro: "I manage housekeeping for an office / society / site and need a proposal.",
  waText: "Hi Sahara, I manage a site in Pune and need a B2B housekeeping proposal.",
  hero: {
    title: "B2B Housekeeping & Facility Services in Pune",
    subtitle: "Office, IT park and housing-society housekeeping, plus post-construction handover cleaning, from one in-house team with GST invoicing.",
    badge: "Business desk",
    image: "/marketing/hero-commercial-v2.webp",
    alt: "Sahara housekeeping team at a Pune commercial site",
    points: ["In-house, trained, background-verified staff", "100% Pay After Service — no advance to start", "Supervisor reporting and shift plans around your hours", "Both Pune branches: Magarpatta City and Mohammadwadi"],
  },
  tiles: [
    { title: "Office & IT park housekeeping", text: "Daily or periodic housekeeping for workstations, pantries, washrooms, common areas and glass." },
    { title: "Housing society housekeeping", text: "Housekeeping staff and soft services for apartment societies and townships on contract (AMC)." },
    { title: "Post-construction handover cleaning", text: "Builder, contractor and designer handover cleaning after civil, carpentry and painting work." },
    { title: "Housekeeping + pest control", text: "Bundle routine housekeeping with scheduled pest-control visits." },
  ],
  process: ["Share the site, area and shift needs on WhatsApp", "Site visit to agree scope, manpower and schedule in writing", "Staff deployed with a supervisor and attendance reporting", "Monthly review and GST invoice"],
  panelTitle: "What a housekeeping contract covers",
  panelItems: ["Housekeeping staff by shift", "Periodic machine scrubbing and carpet cleaning", "Washroom, pantry and terrace upkeep", "Glass and facade cleaning with a safety method", "Scheduled pest control and deep-cleaning visits"],
  form: { title: "Request a B2B housekeeping proposal", serviceLabel: "B2B housekeeping", typeLabel: "Site type", typeOptions: ["Office / IT park", "Housing society / township", "Hospital / clinic", "Mall / commercial complex", "Industrial / warehouse", "Post-construction handover"], cta: "Request Proposal" },
  faqs: [
    { q: "Which Pune businesses and societies does Sahara provide housekeeping for?", a: "Offices, IT parks, housing societies and townships, hospitals and clinics, malls, showrooms, warehouses and industrial units across Pune and Pimpri-Chinchwad." },
    { q: "Is any advance payment needed?", a: "No. Sahara works on 100% Pay After Service, so nothing is paid to confirm the work." },
    { q: "Is the staff in-house?", a: "Yes. Housekeeping is done by trained, background-verified Sahara staff, not outsourced freelancers." },
    { q: "Do you do post-construction handover cleaning?", a: "Yes, for builders, contractors and interior designers after civil, carpentry and painting work." },
    { q: "How are contracts billed?", a: "Monthly or per job, with a GST invoice. Scope and manpower are agreed in writing after a site visit." },
  ],
  linkPages: [
    { label: "Corporate facility management", href: "/b2b/corporate-facility" },
    { label: "Housekeeping services", href: "/housekeeping-services" },
    { label: "Office cleaning in Kharadi", href: "/services/office-cleaning-housekeeping/kharadi" },
    { label: "All Pune areas", href: "/services/facility-management" },
  ],
};

export default function B2bHousekeepingPunePage() {
  return <B2bPage cfg={CFG} />;
}
