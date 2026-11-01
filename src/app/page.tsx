import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PUBLIC_BOOKING_HOST, INTERNAL_CRM_HOST } from "@/lib/site-urls";
import { HomePage } from "@/components/public/home-page";

// "/" is the public homepage on the website hosts (booking.* today, www once DNS moves off WordPress) and the CRM entry
// point everywhere else. Rendered per request (host-dependent; the Docker build has no database).
export const dynamic = "force-dynamic";

const PUBLIC_HOSTS = new Set([PUBLIC_BOOKING_HOST, "www.saharacleaningservices.com", "saharacleaningservices.com"].filter(Boolean));
const TITLE = "Sahara Cleaning Services Pune — Home & Office Deep Cleaning, Pest Control, Painting";
const DESC = "Pune's trusted cleaning team since 2012: home deep cleaning, office housekeeping & facility management, post-interior cleaning, pest control and painting across Pune & PCMC. Book online or call.";

async function isPublicHost() {
  const host = (await headers()).get("host")?.split(":")[0] ?? "";
  return !!PUBLIC_BOOKING_HOST && PUBLIC_BOOKING_HOST !== INTERNAL_CRM_HOST && PUBLIC_HOSTS.has(host);
}

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isPublicHost())) return {};
  return { title: TITLE, description: DESC, alternates: { canonical: "https://booking.saharacleaningservices.com/" }, robots: { index: true, follow: true }, openGraph: { type: "website", url: "https://booking.saharacleaningservices.com/", title: TITLE, description: DESC, siteName: "Sahara Cleaning Services", locale: "en_IN", images: ["https://booking.saharacleaningservices.com/marketing/hero-home.webp"] } };
}

export default async function RootPage() {
  if (await isPublicHost()) return <HomePage />;
  redirect("/dashboard");
}
