import type { Metadata } from "next";
import { BookingWizard } from "@/components/public/booking-wizard";
import { getPublicPricing } from "@/server/pricing";
import { getCompanySettings } from "@/server/settings";
import { paymentDetailsFrom } from "@/lib/booking-payment";

// Chrome-less booking form for the in-place booking drawer on saharacleaningservices.com (owner 2026-10-29).
// Same wizard and deep links as /booking (?service=kitchen|bathroom|sofa|mattress|carpet|window|pest|post-construction,
// ?combo=<COMBO contentId>). Only the marketing site may frame this route (frame-ancestors in next.config.ts).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a service | Sahara Cleaning Services",
  robots: { index: false, follow: false },
};

export default async function BookEmbedPage() {
  const [settings, pricing] = await Promise.all([getCompanySettings(), getPublicPricing()]);
  return (
    <main className="min-h-screen bg-white px-3 py-4 sm:px-5">
      <section id="book" className="mx-auto max-w-2xl">
        <BookingWizard quote={null} hidePicker={false} pricing={pricing} paymentDetails={paymentDetailsFrom(settings)} />
      </section>
    </main>
  );
}
