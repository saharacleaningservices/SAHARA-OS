import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PUBLIC_BOOKING_HOST, INTERNAL_CRM_HOST } from "@/lib/site-urls";
import BookingPage from "@/app/booking/page";
import { HomePage } from "@/components/public/home-page";
import { SITE_ORIGIN, MAIN_HOST } from "@/lib/site-origin";

// "/" is the public homepage on the website hosts (booking.* today, www once DNS moves off WordPress) and the CRM entry
// point everywhere else. Rendered per request (host-dependent; the Docker build has no database).
export const dynamic = "force-dynamic";

const PUBLIC_HOSTS = new Set([PUBLIC_BOOKING_HOST, `www.${MAIN_HOST}`, MAIN_HOST].filter(Boolean));
const TITLE = "Sahara Cleaning Services Pune — Home & Office Deep Cleaning, Pest Control, Painting";
const DESC = "Pune's trusted cleaning team since 2012: home deep cleaning, office housekeeping & facility management, post-interior cleaning, pest control and painting across Pune & PCMC. Book online or call.";

async function isPublicHost() {
  const host = (await headers()).get("host")?.split(":")[0] ?? "";
  return !!PUBLIC_BOOKING_HOST && PUBLIC_BOOKING_HOST !== INTERNAL_CRM_HOST && PUBLIC_HOSTS.has(host);
}

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isPublicHost())) return {};
  return { title: TITLE, description: DESC, alternates: { canonical: `${SITE_ORIGIN}/` }, robots: { index: true, follow: true }, openGraph: { type: "website", url: `${SITE_ORIGIN}/`, title: TITLE, description: DESC, siteName: "Sahara Cleaning Services", locale: "en_IN", images: [`${SITE_ORIGIN}/marketing/hero-home.webp`] } };
}

type RootSearchParams = Parameters<typeof BookingPage>[0]["searchParams"];

// "/" is the complete main website (header, hero, 4-card service grid, BHK price cards + same-page lead form, service sections, reviews, FAQ, footer).
// Only a personalised/quotation link (?quote= / ?bl=) opens the focused booking view, because those carry a pre-filled quotation.
export default async function RootPage({ searchParams }: { searchParams: RootSearchParams }) {
  if (!(await isPublicHost())) redirect("/dashboard");
  const sp = await searchParams;
  if (sp.quote) return BookingPage({ searchParams: Promise.resolve(sp) });
  return <HomePage />;
}
