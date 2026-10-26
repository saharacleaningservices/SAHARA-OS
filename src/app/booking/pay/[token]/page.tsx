import type { Metadata } from "next";
import { BookingPageView } from "@/components/public/booking-page-view";

// /booking/pay/{Job.publicToken} — WhatsApp "Payment Options" button. Plain token only (no query string:
// Meta percent-encodes special characters in URL-button variables). Same validation as /booking/{token}.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment Options — Sahara Cleaning Services", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BookingPageView token={token} focus="pay" />;
}
