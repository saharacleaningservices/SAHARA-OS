import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/server/settings";
import { LandingShell, Hero, PackageGrid, ScopeLists, HowItWorks, Faqs, Terms, BASE_URL, CAROUSEL, businessJsonLd, faqJsonLd } from "@/components/public/landing-kit";
import { BookingWizard, type QuotePrefill } from "@/components/public/booking-wizard";
import { PREMIUM, PLATINUM, PREMIUM_SCOPE, PREMIUM_EXCLUDED, SMALL_SERVICES, COMBOS, inr } from "@/lib/marketing-content";

// Customer booking page in the approved transparent-pricing landing design.
// /booking                → pick a package, date, available slot, payment preference
// /booking?quote=<token>  → quotation booking: customer only picks date, slot, payment
// Submitting creates a booking REQUEST; the office confirms it in the CRM.

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ quote?: string }> }): Promise<Metadata> {
  const { quote } = await searchParams;
  return {
    title: "Book Professional Cleaning in Pune & PCMC – Available Slots | Sahara Cleaning Services",
    description: "Book home cleaning, commercial cleaning, pest control and interior painting across Pune & PCMC: transparent prices, real available slots, pay advance or after service. Festival cleaning slots for Navratri, Dussehra and Diwali.",
    alternates: { canonical: `${BASE_URL}/booking` },
    robots: quote ? { index: false, follow: false } : undefined,
  };
}

const WA = "Hi Sahara, I'd like help with my booking.";
const FAQS = [
  { q: "Is my booking confirmed when I submit the form?", a: "No — it's a booking request. Our team checks the slot and confirms it; you then receive the confirmation with your booking link on WhatsApp." },
  { q: "How are available slots decided?", a: "Slots come from our live booking calendar and team capacity. Dates and times that are already full can't be selected." },
  { q: "Can I pay after the service?", a: "Yes. Choose Pay After Service, or choose Pay Advance to secure your slot — payment details are on your booking page." },
  { q: "What is the difference between Premium and Platinum?", a: "Both include the same complete cleaning scope. Premium includes wall dry dusting; Platinum includes wall wet cleaning. Both include ceiling dry dusting." },
  { q: "Are there minimum quantities?", a: "Sofa cleaning needs a minimum of 5 seats, bathroom cleaning 2 bathrooms and mattress cleaning 2 mattresses." },
];
const EQUIPMENT = ["Commercial vacuum cleaners", "Scrubbing machines where applicable", "Upholstery shampoo machine for sofa / carpet / mattress", "Microfiber system", "Appropriate cleaning chemicals"];

async function loadQuote(token?: string): Promise<QuotePrefill | null> {
  if (!token || !/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const q = await db.quotation.findFirst({
    where: { publicToken: token, status: { notIn: ["REJECTED", "CANCELLED", "EXPIRED"] } },
    include: { lead: { select: { name: true, mobile: true, deletedAt: true } } },
  });
  if (!q || q.lead.deletedAt) return null;
  let services: string[] = [];
  try {
    services = (JSON.parse(q.services) as { name?: string }[]).map((s) => s.name ?? "").filter(Boolean);
  } catch {
    services = [];
  }
  return { token, quoteNumber: q.quoteNumber, customerName: q.lead.name, mobile: q.lead.mobile, services: services.length ? services : ["As per quotation"], totalAmount: q.totalAmount };
}

const CATEGORY: Record<string, "HOME" | "COMMERCIAL" | "PEST" | "PAINTING"> = { home: "HOME", commercial: "COMMERCIAL", pest: "PEST", painting: "PAINTING" };

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string; service?: string; ref?: string; name?: string; mobile?: string; phone?: string; customer?: string }>;
}) {
  const { quote: quoteToken, service, ref, name, customer, mobile, phone } = await searchParams;
  const [settings, quote] = await Promise.all([getCompanySettings(), loadQuote(quoteToken)]);

  return (
    <LandingShell logoUrl={settings.logoUrl} waText={WA} jsonLd={[businessJsonLd(), faqJsonLd(FAQS)]}>
      <Hero
        image={CAROUSEL.team.src}
        alt={CAROUSEL.team.alt}
        images={[CAROUSEL.team, CAROUSEL.equipment, CAROUSEL.result]}
        eyebrow={quote ? `Quotation ${quote.quoteNumber}` : "Navratri • Dussehra • Diwali · Festival cleaning"}
        title={quote ? `Book your service, ${quote.customerName.split(" ")[0]}` : "Professional Cleaning Services Across Pune & PCMC"}
        subtitle={quote ? "Pick a date, an available time slot and your payment preference." : "Transparent prices, real available slots, and pay advance or after service. Book early to get your preferred festival slot."}
        primaryLabel="Choose Date & Slot"
        primaryHref="#book"
        waText={WA}
      />
      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        {quoteToken && !quote && (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">This quotation link is no longer valid. You can still book below, or call us on 8956567130 / 7083347130.</p>
        )}
        <section id="book" className="scroll-mt-20">
          <BookingWizard
            quote={quote}
            defaultCategory={CATEGORY[service ?? ""]}
            referralCode={ref}
            prefill={{ name: name ?? customer, mobile: mobile ?? phone }}
          />
        </section>

        {!quote && (
          <>
            <section>
              <h2 className="text-2xl font-bold">Premium home deep cleaning</h2>
              <p className="text-sm text-[#0a2540]/70">Complete top-to-bottom cleaning · wall dry dusting · ceiling dry dusting · estimated 7–8 hours.</p>
              <PackageGrid items={PREMIUM} />
              <ScopeLists included={PREMIUM_SCOPE} excluded={PREMIUM_EXCLUDED} />
            </section>
            <section>
              <h2 className="text-2xl font-bold">Platinum home deep cleaning</h2>
              <p className="mt-1 inline-block rounded-lg bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">⭐ WALL WET CLEANING &amp; CEILING DRY DUSTING INCLUDED</p>
              <p className="mt-1 text-sm text-[#0a2540]/70">The same complete scope as Premium — with wall wet cleaning instead of wall dry dusting.</p>
              <PackageGrid items={PLATINUM} accent />
            </section>
            <section>
              <h2 className="text-2xl font-bold">Individual services &amp; combos</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {SMALL_SERVICES.map((s) => (
                  <div key={s.name} className="rounded-2xl bg-white p-4 shadow-sm">
                    <h3 className="font-bold">{s.name}</h3>
                    <p className="text-xl font-extrabold text-primary">{s.price == null ? <span className="text-sm font-semibold">{s.priceNote}</span> : <>{inr(s.price)} <span className="text-xs font-medium text-[#0a2540]/70">{s.unit}</span></>}</p>
                    <p className="text-xs font-bold uppercase text-amber-700">{s.rule}</p>
                  </div>
                ))}
                {COMBOS.map((c) => (
                  <div key={c.name} className="rounded-2xl bg-white p-4 shadow-sm">
                    <h3 className="font-bold">{c.name}</h3>
                    <p className="text-xl font-extrabold text-primary">{inr(c.price)}</p>
                    {c.note && <p className="text-xs font-semibold text-amber-700">{c.note}</p>}
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-xl font-bold">Professional equipment</h2>
              <ul className="mt-2 grid gap-1 text-sm text-[#0a2540]/80 sm:grid-cols-2">{EQUIPMENT.map((e) => <li key={e}>• {e}</li>)}</ul>
            </section>
          </>
        )}
        <HowItWorks />
        <Faqs faqs={FAQS} />
        <Terms />
      </main>
    </LandingShell>
  );
}
