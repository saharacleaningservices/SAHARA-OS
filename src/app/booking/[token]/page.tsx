import type { Metadata } from "next";
import { BookingPageView } from "@/components/public/booking-page-view";

// Customer booking page — /booking/{Job.publicToken}. Body + token validation in BookingPageView.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Booking — Sahara Cleaning Services", robots: { index: false, follow: false } };

export default async function BookingPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ pay?: string }> }) {
  const { token } = await params;
  const { pay } = await searchParams;
  return <BookingPageView token={token} pay={pay} />;
}
