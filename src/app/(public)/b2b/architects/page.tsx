import type { Metadata } from "next";
import { BASE_URL } from "@/components/public/landing-kit";
import { B2bPage, type B2bConfig } from "@/components/public/b2b-page";

export const revalidate = 86400;

const TITLE = "Post-Interior Cleaning for Architects & Interior Designers in Pune | Sahara";
const DESC = "Handover-ready post-interior and post-renovation cleaning for Pune architects, interior designers and contractors. Fixed schedules, written scope, GST invoice. Magarpatta & Mohammadwadi branches.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${BASE_URL}/b2b/architects` },
  robots: { index: true, follow: true },
  openGraph: { type: "website", url: `${BASE_URL}/b2b/architects`, title: TITLE, description: DESC, siteName: "Sahara Cleaning Services", locale: "en_IN" },
};

const CFG: B2bConfig = {
  path: "/b2b/architects",
  vertical: "post-interior",
  waIntro: "I am an architect / interior designer and need post-interior cleaning for a project.",
  waText: "Hi Sahara, I am an architect / interior designer and need post-interior cleaning for a project in Pune.",
  hero: {
    title: "Post-Interior Cleaning for Pune Architects & Interior Designers",
    subtitle: "Dust, putty, paint and cement removed so your project is handover-ready on the day you promised the client.",
    badge: "Architect & designer desk",
    image: "/marketing/hero-commercial-v2.webp",
    alt: "Sahara crew doing post-interior cleaning on a finished Pune project",
    points: ["Fixed handover-date scheduling", "Written scope per site before work", "Photo handover record on request", "GST invoice per project, monthly billing for studios"],
  },
  tiles: [
    { title: "Home & villa fit-outs", text: "Whole-home post-interior cleaning: ceilings, modular kitchen, wardrobes, glass, floors and fixtures." },
    { title: "Office fit-outs", text: "Workstations, partitions, pantry, washrooms and common areas cleaned before the client moves in." },
    { title: "Showroom & retail", text: "Display glass, flooring, signage fixtures and back-of-house areas finished for opening day." },
    { title: "Repeat project partners", text: "A single contact for studios with several live sites; schedules shared per project." },
  ],
  process: ["Share the site address, size and handover date on WhatsApp", "Site visit or photo review to fix the scope in writing", "Crew dispatched from the nearest branch, supervised on site", "Handover walk-through and invoice per project"],
  panelTitle: "Typical post-interior scope",
  panelItems: ["Fine-dust removal from walls, ceilings, lights and fixtures", "Paint, putty and cement-splash removal", "Glass, frame and window-channel cleaning", "Modular kitchen and wardrobe interior wipe-down", "Machine scrubbing of floors, with protection for finished surfaces"],
  form: { title: "Request a post-interior cleaning proposal", serviceLabel: "Post-interior cleaning (architect / designer)", typeLabel: "Site type", typeOptions: ["Home (1–2 BHK)", "Home (3 BHK+) / Villa", "Office fit-out", "Showroom / retail fit-out", "Multiple projects (studio)"], cta: "Request Proposal" },
  faqs: [
    { q: "Do you work with architects and interior designers in Pune?", a: "Yes. Sahara handles post-interior and post-renovation cleaning for design studios, contractors and home owners across Pune and PCMC." },
    { q: "Can you match our handover date?", a: "Yes. Share the date when you enquire; the crew is scheduled to finish before it, and the scope is agreed in writing first." },
    { q: "Do you protect finished surfaces?", a: "The crew uses surface-appropriate tools and chemicals and avoids abrasive methods on finished materials. Tell us about delicate finishes when you book." },
    { q: "Do you issue GST invoices for projects?", a: "Yes, a GST invoice per project, or monthly billing for studios with multiple sites." },
  ],
  linkPages: [
    { label: "Post-interior cleaning in Baner", href: "/services/post-interior-cleaning/baner" },
    { label: "Post-interior cleaning in Kharadi", href: "/services/post-interior-cleaning/kharadi" },
    { label: "Post-interior cleaning in Kothrud", href: "/services/post-interior-cleaning/kothrud" },
    { label: "All Pune areas", href: "/services/post-interior-cleaning" },
  ],
};

export default function ArchitectsPage() {
  return <B2bPage cfg={CFG} />;
}
