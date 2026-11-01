import type { Metadata } from "next";
import { ShieldCheck, Star, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/server/settings";
import { getPublicPricing } from "@/server/pricing";
import { paymentDetailsFrom } from "@/lib/booking-payment";
import { LandingShell, CallWhatsAppBar, businessJsonLd } from "@/components/public/landing-kit";
import { BookingFooter } from "@/components/public/booking-footer";
import { BookingWizard } from "@/components/public/booking-wizard";
import { BookingLinkPing } from "@/components/public/booking-link-ping";
import type { HomeTier } from "@/lib/service-scope";
import { TRUST } from "@/lib/booking-target";

// Streamlined checkout (owner 2026-11-01). The homepage shows the 4 service cards and the BHK price card; their Book Now
// buttons open this page with the choice pre-filled, so the homepage never carries the booking form.
//   /booking/checkout?service=home&bhk=2 BHK&tier=Premium   → Home → that package, straight to date & slot
//   /booking/checkout?service=pest|commercial|painting     → that service
//   ?bl=<token> / ?name= / ?mobile= / ?ref=                → same prefill rules as before
// Layout model: BOXED — one max-w-3xl column; the site header and footer stay so the brand never disappears.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book Your Service | Sahara Cleaning Services Pune",
  description: "Pick a date and an available slot, add your address and choose pay after service or advance.",
  robots: { index: false, follow: true },
};

const WA = "Hi Sahara, I'd like help with my booking.";
const CATEGORY: Record<string, "HOME" | "COMMERCIAL" | "PEST" | "PAINTING"> = { home: "HOME", commercial: "COMMERCIAL", pest: "PEST", painting: "PAINTING" };
const BHKS = ["1 BHK", "2 BHK", "3 BHK", "4 BHK"];
const TIERS: HomeTier[] = ["Premium", "Platinum"];

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ service?: string; bhk?: string; tier?: string; ref?: string; bl?: string; name?: string; mobile?: string; phone?: string; customer?: string }> }) {
  const { service, bhk, tier, ref, bl, name, customer, mobile, phone } = await searchParams;
  const link = bl && /^[a-f0-9]{8,64}$/.test(bl) ? await db.bookingLink.findUnique({ where: { token: bl }, select: { customerName: true, customerMobile: true } }).catch(() => null) : null;
  const [settings, pricing] = await Promise.all([getCompanySettings(), getPublicPricing()]);
  const size = BHKS.includes(bhk ?? "") ? bhk! : "";
  const pkg = TIERS.find((t) => t === tier);
  // 4 BHK has no instant price (site inspection first), so it opens without a package.
  const preset = size && (pkg || size === "4 BHK") ? { bhk: size, pkg: (pkg ?? "") as HomeTier } : undefined;

  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd()]} mobileBar={<CallWhatsAppBar waText={WA} />} footer={<BookingFooter />} bookHref="#book">
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:py-8">
        <header className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
          <h1 className="text-xl font-extrabold text-[#0a2540] sm:text-2xl">Book your service</h1>
          <p className="mt-1 text-sm text-[#0a2540]/70">{preset ? `${preset.bhk}${preset.pkg ? ` · ${preset.pkg}` : ""} home deep cleaning — pick a date and slot.` : "Choose your service, then a date and an available slot."}</p>
          <ul className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[#0a2540]/80">
            <li className="inline-flex items-center gap-1 rounded-full bg-[#eef4fb] px-2.5 py-1"><ShieldCheck className="size-3.5 text-primary" /> Verified in-house staff</li>
            <li className="inline-flex items-center gap-1 rounded-full bg-[#eef4fb] px-2.5 py-1"><Wallet className="size-3.5 text-primary" /> Pay after service available</li>
            <li className="inline-flex items-center gap-1 rounded-full bg-[#eef4fb] px-2.5 py-1"><Star className="size-3.5 fill-amber-400 text-amber-400" /> {TRUST.rating}★ Google</li>
          </ul>
        </header>
        <section id="book" className="scroll-mt-20">
          {link && <BookingLinkPing token={bl} />}
          <BookingWizard
            quote={null}
            preset={preset}
            defaultCategory={CATEGORY[service ?? ""]}
            referralCode={ref}
            prefill={{ name: link?.customerName || name || customer, mobile: link?.customerMobile ? link.customerMobile.replace(/\D/g, "").slice(-10) : mobile ?? phone }}
            bookingLinkToken={link ? bl : undefined}
            pricing={pricing}
            paymentDetails={paymentDetailsFrom(settings)}
          />
        </section>
      </main>
    </LandingShell>
  );
}
