import Link from "next/link";
import { Phone, ArrowLeft } from "lucide-react";
import { CompanyLogo } from "@/components/shared/company-logo";
import { COMPANY } from "@/lib/constants";
import { toWhatsAppLink } from "@/lib/utils";
import { getCompanySettings } from "@/server/settings";

export const metadata = {
  title: "Terms & Conditions — Sahara Cleaning Services",
  description: "Terms and conditions for booking services with Sahara Cleaning Services.",
};

// Force dynamic (request-time) rendering: this page reads live company
// settings from the database via getCompanySettings(). The database file
// only exists via the runtime persistent volume, not inside the isolated
// Docker build stage, so letting Next.js statically prerender this page at
// build time crashes the build with "Cannot open database because the
// directory does not exist". Deferring to request time avoids that.
export const dynamic = "force-dynamic";

const CALL_NUMBER = COMPANY.phones[0];
const WHATSAPP_NUMBER = COMPANY.phones[1];

export default async function TermsPage() {
  const settings = await getCompanySettings();

  return (
    <div className="min-h-screen bg-[#eef4fb]">
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/book" className="flex items-center gap-2">
            <CompanyLogo logoUrl={settings.logoUrl} className="h-10 w-auto max-w-[150px]" showTm />
          </Link>
          <Link href="/book" className="flex items-center gap-1.5 text-xs font-semibold text-primary sm:text-sm">
            <ArrowLeft className="size-4" /> Back to Booking
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="mt-6 space-y-8 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-8">
          <section>
            <p className="text-sm leading-relaxed text-foreground">
              By booking a service with {COMPANY.name}, you agree to the following terms. Please read them carefully.
              If anything is unclear, call or WhatsApp us before your service date and our team will be happy to
              explain.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">1. Booking Confirmation</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              A booking submitted on our website is received as a request. Our team reviews and verifies every
              request before it is confirmed; the time slot shown on the website is an estimate of availability, not a
              final confirmation. For bookings confirmed verbally over a phone call, we send you a confirmation
              immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">2. Payment</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
              <li>Payment is due immediately after the service is completed, unless another arrangement has been agreed with our team in advance.</li>
              <li>Where an advance has been collected, it will be adjusted against the final bill, with the balance payable on completion.</li>
              <li>In case of delayed or outstanding payment, Sahara Cleaning Services reserves the right to follow up for payment and, where necessary, recover dues as permitted under applicable Indian law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">3. Existing Condition of Property</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              To help our team work safely and carefully, please inform our staff before the service begins about:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
              <li>Any pre-existing damage to surfaces, furniture, or fittings.</li>
              <li>Delicate or fragile surfaces that need special handling.</li>
              <li>Loose fixtures, fittings, or fixtures under repair.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">4. Cleaning &amp; Service Limitations</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Our team uses professional-grade products and equipment to deliver the best possible result. However,
              please note the following limitations, which are a normal part of cleaning and painting work:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
              <li>Pre-existing stains (on fabric, grout, stone, or other surfaces) may improve significantly but are not guaranteed to be fully removed.</li>
              <li>Hard-water stains and mineral deposits are not guaranteed to be fully removed, as this depends on the surface and duration of the staining.</li>
              <li>Some discoloration on aged surfaces, fabrics, or fixtures may be permanent and may not be reversible through cleaning.</li>
              <li>Existing paint defects (such as old cracks, dampness marks, or peeling) and underlying structural issues are outside the normal scope of our cleaning or painting service and may require separate specialist work.</li>
            </ul>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Our team will point out any such pre-existing conditions before starting work wherever possible, so
              expectations are clear on both sides.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">5. Rescheduling &amp; Cancellation</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              We understand plans can change. Please call or WhatsApp us as early as possible if you need to
              reschedule or cancel a booking, so our team can adjust the schedule accordingly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">6. Referral Program</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Referral codes and offers, where applicable, are applied as communicated to you at the time of booking
              and are subject to our team&apos;s verification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">7. Contact</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              For any questions about these terms, write to us at{" "}
              <a href={`mailto:${COMPANY.email}`} className="font-semibold text-primary hover:underline">{COMPANY.email}</a>{" "}
              or call/WhatsApp us using the numbers below.
            </p>
          </section>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <a href={`tel:+91${CALL_NUMBER}`} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm sm:text-sm">
            <Phone className="size-4" /> Call {CALL_NUMBER}
          </a>
          <a href={toWhatsAppLink(WHATSAPP_NUMBER)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-xs font-semibold text-white shadow-sm sm:text-sm">
            <Phone className="size-4" /> WhatsApp {WHATSAPP_NUMBER}
          </a>
        </div>
      </main>
    </div>
  );
}
