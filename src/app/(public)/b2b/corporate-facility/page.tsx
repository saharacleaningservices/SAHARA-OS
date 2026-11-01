import type { Metadata } from "next";
import { BASE_URL } from "@/components/public/landing-kit";
import { B2bPage, type B2bConfig } from "@/components/public/b2b-page";

export const revalidate = 86400;

const TITLE = "Corporate Facility Management & Housekeeping in Pune | Sahara";
const DESC = "Office housekeeping, office boys, security manpower and facility management AMC for Pune offices, IT parks, malls, hospitals and industrial sites. GST invoice. Magarpatta & Mohammadwadi branches.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${BASE_URL}/b2b/corporate-facility` },
  robots: { index: true, follow: true },
  openGraph: { type: "website", url: `${BASE_URL}/b2b/corporate-facility`, title: TITLE, description: DESC, siteName: "Sahara Cleaning Services", locale: "en_IN" },
};

const CFG: B2bConfig = {
  path: "/b2b/corporate-facility",
  vertical: "commercial",
  waIntro: "I manage a corporate site and need facility management / housekeeping.",
  waText: "Hi Sahara, I manage a corporate site in Pune and need a facility management / housekeeping proposal.",
  hero: {
    title: "Corporate Facility Management & Housekeeping in Pune",
    subtitle: "Housekeeping, office boys, security and periodic deep cleaning under one contract, with monthly GST invoicing.",
    badge: "Corporate desk",
    image: "/marketing/hero-commercial-v2.webp",
    alt: "Sahara housekeeping team at a Pune corporate office",
    points: ["Trained, uniformed manpower with supervisor reporting", "Shift plans around your working hours", "One contract for housekeeping, security and deep cleaning", "Monthly GST invoicing"],
  },
  tiles: [
    { title: "Office housekeeping", text: "Daily housekeeping staff and office boys for workstations, pantries, washrooms and common areas." },
    { title: "Security manpower", text: "Security guards supplied alongside housekeeping under the same facility contract." },
    { title: "Malls, hospitals, industrial", text: "Machine floor care, hospital-grade sanitising, warehouse degreasing and facade cleaning with a safety method." },
    { title: "Housekeeping + pest control", text: "Bundle routine housekeeping with scheduled pest-control visits." },
  ],
  process: ["Share the site, headcount and shift needs on WhatsApp", "Site visit to agree manpower, scope and schedule in writing", "Staff deployed with a supervisor and attendance reporting", "Monthly review and GST invoice"],
  panelTitle: "What a facility contract covers",
  panelItems: ["Housekeeping staff and office boys by shift", "Security guard manpower", "Periodic machine scrubbing and carpet cleaning", "Washroom, pantry and terrace upkeep", "Scheduled pest control and deep-cleaning visits"],
  form: { title: "Request a facility management proposal", serviceLabel: "Corporate facility management", typeLabel: "Facility type", typeOptions: ["Office / IT park", "Co-working / startup", "Mall / commercial complex", "Hospital / clinic", "Industrial / warehouse", "Society / township"], cta: "Request Proposal" },
  faqs: [
    { q: "Do you provide housekeeping and office boys for corporate offices in Pune?", a: "Yes. Sahara supplies trained housekeeping staff and office boys on a contract basis for offices across Pune and PCMC." },
    { q: "Can you also supply security guards?", a: "Yes, security manpower can be included in the same facility management contract." },
    { q: "Which premises do you cover?", a: "Offices, IT parks, showrooms, malls, hospitals, industrial units, warehouses and housing societies, plus glass and facade cleaning." },
    { q: "How are contracts billed?", a: "Monthly, with a GST invoice. Scope and manpower are agreed in writing after a site visit." },
  ],
  linkPages: [
    { label: "Facility management in Kharadi", href: "/services/facility-management/kharadi" },
    { label: "Facility management in Hinjewadi", href: "/services/facility-management/hinjewadi" },
    { label: "Office housekeeping in Magarpatta City", href: "/services/office-cleaning-housekeeping/magarpatta" },
    { label: "All Pune areas", href: "/services/facility-management" },
  ],
};

export default function CorporateFacilityPage() {
  return <B2bPage cfg={CFG} />;
}
