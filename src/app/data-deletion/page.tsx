import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CompanyLogo } from "@/components/shared/company-logo";
import { COMPANY } from "@/lib/constants";
import { getCompanySettings } from "@/server/settings";

export const metadata = {
  title: "Data Deletion — Sahara Cleaning Services",
  description: "How to ask Sahara Cleaning Services to delete your personal data, including WhatsApp conversation data.",
};

// Request-time rendering for the same reason as /privacy-policy: company
// settings come from the runtime database, which doesn't exist at build time.
export const dynamic = "force-dynamic";

// Public data-deletion instructions page — referenced as the "User data
// deletion" URL in the Meta app settings for the WhatsApp Cloud API app.
export default async function DataDeletionPage() {
  const settings = await getCompanySettings();

  return (
    <div className="min-h-screen bg-[#eef4fb]">
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/booking" className="flex items-center gap-2">
            <CompanyLogo logoUrl={settings.logoUrl} className="h-10 w-auto max-w-[150px]" showTm />
          </Link>
          <Link href="/booking" className="flex items-center gap-1.5 text-xs font-semibold text-primary sm:text-sm">
            <ArrowLeft className="size-4" /> Back to Booking
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-extrabold text-foreground sm:text-3xl">Data Deletion Instructions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sahara Cleaning Services</p>

        <div className="mt-6 space-y-6 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-8">
          <section>
            <h2 className="text-lg font-bold text-foreground">What data we hold</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              When you book with us or message us on WhatsApp, we keep your name, phone number, service address,
              booking details and the messages you exchange with our team. We use this only to deliver and support
              the service you asked for. See our{" "}
              <Link href="/privacy-policy" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">How to request deletion</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-foreground">
              <li>
                Email{" "}
                <a href={`mailto:${COMPANY.email}?subject=Data%20deletion%20request`} className="font-semibold text-primary hover:underline">{COMPANY.email}</a>{" "}
                with the subject &ldquo;Data deletion request&rdquo;, or send the message &ldquo;Delete my data&rdquo; to us on WhatsApp.
              </li>
              <li>Include the mobile number you used with us so we can find your records.</li>
              <li>We confirm the request and delete your personal data and WhatsApp conversation history within 30 days.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">What we may keep</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Invoices and payment records that we must keep for accounting, tax or legal reasons are retained only for
              the period the law requires, and are not used for marketing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">Stop promotional messages only</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              If you only want to stop offers and promotions, reply &ldquo;STOP&rdquo; on WhatsApp. You will still receive
              messages about bookings you make.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
