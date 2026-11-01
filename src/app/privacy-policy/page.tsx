import Link from "next/link";
import { Phone, ArrowLeft } from "lucide-react";
import { CompanyLogo } from "@/components/shared/company-logo";
import { COMPANY } from "@/lib/constants";
import { toWhatsAppLink } from "@/lib/utils";
import { getCompanySettings } from "@/server/settings";

export const metadata = {
  title: "Privacy Policy — Sahara Cleaning Services",
  description: "How Sahara Cleaning Services collects, uses and protects your information.",
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

export default async function PrivacyPolicyPage() {
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
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="mt-6 space-y-8 rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-8">
          <section>
            <p className="text-sm leading-relaxed text-foreground">
              {COMPANY.name} (&ldquo;Sahara,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your
              privacy. This Privacy Policy explains what information we collect when you use our website and booking
              form, how we use it, and the steps we take to keep it secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">1. Information We Collect</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              When you book a service or contact us, we may collect:
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
              <li>Your name, mobile number and (if provided) email address.</li>
              <li>Your service address and, where shared, your location details.</li>
              <li>Details of the service you request, your preferred date and time, and any notes you add.</li>
              <li>Payment-related information such as the amount paid and payment mode (we do not store card, UPI PIN, or banking credentials — payments are made directly through your bank or UPI app).</li>
              <li>How you heard about us, if you choose to share it.</li>
              <li>Basic technical information such as browser type and device, used only to keep the website working correctly.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">2. How We Use Your Information</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">We use the information you provide to:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
              <li>Schedule, confirm and deliver the cleaning, painting or pest-control service you request.</li>
              <li>Contact you by call or WhatsApp about your booking, quotation, or service visit.</li>
              <li>Maintain accurate service and payment records for our own accounting and quality checks.</li>
              <li>Improve our services and respond to feedback or complaints.</li>
              <li>Meet legal, tax and regulatory obligations under applicable Indian law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">3. Secure Storage</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Your information is stored on secured systems accessible only to authorised Sahara staff who need it to
              carry out your booking. We take reasonable technical and organisational measures to protect your data
              against unauthorised access, loss, or misuse. No booking-related photos, images, or media of your home or
              premises are collected or stored through our website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">4. No Third-Party Marketing Sale</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              We do not sell, rent, or trade your personal information to third parties for their marketing purposes.
              Your details are used solely by Sahara Cleaning Services to deliver and support the service you booked.
              We may share limited information with trusted service providers (for example, payment or communication
              platforms) strictly to the extent needed to operate our booking and service delivery — never for their
              independent marketing use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">5. Your Choices</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              The &ldquo;How did you hear about Sahara?&rdquo; field on our booking form is entirely optional. You may
              contact us at any time to ask what information we hold about you, to request a correction, or to request
              that we delete records we are not otherwise required to keep for accounting or legal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground">6. Contact Us</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              For any privacy-related questions, write to us at{" "}
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
