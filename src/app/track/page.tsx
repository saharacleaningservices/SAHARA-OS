import type { Metadata } from "next";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, BASE_URL, businessJsonLd } from "@/components/public/landing-kit";
import { TrackForm } from "@/components/public/track-form";

// Rendered per request: reads Company Settings (the Docker build has no database).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track Your Booking | Sahara Cleaning Services",
  description: "Track your Sahara booking with your Job ID and a one-time code sent on WhatsApp.",
  alternates: { canonical: `${BASE_URL}/track` },
  robots: { index: false, follow: false },
};

/** Customer order tracker (Phase 2): Job ID + WhatsApp OTP → the booking page (status, crew, invoice, payment). */
export default async function TrackPage() {
  const settings = await getCompanySettings();
  return (
    <LandingShell logoUrl={settings.logoUrl} waText="Hi Sahara, I'd like an update on my booking." jsonLd={[businessJsonLd()]}>
      <main className="mx-auto max-w-md space-y-4 px-4 py-8">
        <header>
          <h1 className="text-2xl font-extrabold text-[#0a2540]">Track your booking</h1>
          <p className="mt-1 text-sm text-[#0a2540]/70">Enter the Job ID from your booking confirmation and your mobile number. We&apos;ll send a one-time code on WhatsApp.</p>
        </header>
        <TrackForm />
      </main>
    </LandingShell>
  );
}
