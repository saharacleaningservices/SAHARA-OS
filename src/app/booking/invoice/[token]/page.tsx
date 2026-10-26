import type { Metadata } from "next";
import { BookingPageView } from "@/components/public/booking-page-view";

// /booking/invoice/{Job.publicToken} — the final customer invoice, available only once the
// job is COMPLETED (404 otherwise). Same unguessable-token validation as /booking/{token}.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Invoice — Sahara Cleaning Services", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BookingPageView token={token} focus="invoice" />;
}
