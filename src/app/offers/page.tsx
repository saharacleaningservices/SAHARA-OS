import type { Metadata } from "next";
import { Phone, Check, MapPin, Star, ShieldCheck, Sparkles } from "lucide-react";
import {
  COMPANY,
  HOME_CLEANING_PACKAGES,
  HOME_SERVICE_UNIT_PRICE,
  SOFA_SEATER_PRICES,
  MATTRESS_UNIT_PRICE,
  PEST_PROPERTY_SIZE_PRICES,
} from "@/lib/constants";
import { toWhatsAppLink } from "@/lib/utils";

// Public Festival / Home Cleaning landing page. Structure-first: every image
// is an ImageSlot placeholder with a fixed aspect ratio — swap each for a
// real <Image> later without touching layout.

const BOOK_URL = "https://booking.saharacleaningservices.com";
const CALL_NUMBER = COMPANY.phones[0];
const WHATSAPP_NUMBER = COMPANY.phones[1];

export const metadata: Metadata = {
  title: "Festival Home Deep Cleaning in Pune | Sahara Cleaning Services",
  description:
    "Festival & home deep cleaning in Pune — kitchen, bathroom, sofa, full home packages, painting & pest control. Transparent pricing, trained team. Book online or WhatsApp.",
  alternates: { canonical: "/offers" },
  openGraph: {
    title: "Festival Home Deep Cleaning — Sahara Cleaning Services, Pune",
    description: "Transparent pricing. Trained team. Book your festival deep clean today.",
    type: "website",
  },
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function ImageSlot({ label, ratio, className = "" }: { label: string; ratio: string; className?: string }) {
  return (
    <div
      data-image-slot={label}
      style={{ aspectRatio: ratio }}
      className={`flex w-full items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-center text-xs font-medium text-primary/70 ${className}`}
    >
      <span className="px-3">IMAGE: {label}<br />({ratio.replace(" / ", ":")})</span>
    </div>
  );
}

function BookButton({ className = "" }: { className?: string }) {
  return (
    <a href={BOOK_URL} className={`inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 ${className}`}>
      Book Now
    </a>
  );
}

const OFFERS = [
  { title: "Festival Full Home Deep Clean", text: "Get your whole home festival-ready — kitchen, bathrooms, floors, windows & fittings.", slot: "Festival" },
  { title: "Kitchen + Bathroom Combo", text: "The two toughest rooms, degreased and descaled in one visit.", slot: "Kitchen" },
  { title: "Sofa & Mattress Refresh", text: "Shampoo cleaning for sofas and mattresses before guests arrive.", slot: "Home cleaning" },
];

const PRICES: { name: string; price: string }[] = [
  { name: "Kitchen Deep Cleaning", price: `${inr(HOME_SERVICE_UNIT_PRICE["Kitchen Deep Cleaning"])} onwards` },
  { name: "Bathroom Cleaning", price: `${inr(HOME_SERVICE_UNIT_PRICE["Bathroom Cleaning"])} / bathroom (min 2)` },
  { name: "Sofa Shampooing", price: `${inr(SOFA_SEATER_PRICES["1 Seater"])} / seat` },
  { name: "Mattress Cleaning", price: `${inr(MATTRESS_UNIT_PRICE.Single)} single · ${inr(MATTRESS_UNIT_PRICE.Double)} double` },
  { name: "Window Cleaning", price: `${inr(HOME_SERVICE_UNIT_PRICE["Window Cleaning"])} / window (min 5)` },
  { name: "Curtain Cleaning", price: `${inr(HOME_SERVICE_UNIT_PRICE["Curtain Cleaning"])} / pair (min 2)` },
  { name: "Carpet Cleaning", price: `${inr(HOME_SERVICE_UNIT_PRICE["Carpet Cleaning"])} / carpet (min 2)` },
  { name: "Pest Control", price: `${inr(PEST_PROPERTY_SIZE_PRICES["1 BHK"])} onwards` },
];

const INCLUDED = [
  "Kitchen: cabinets inside & out, tiles, platform, sink, chimney exterior",
  "Bathrooms: tiles, fittings, mirrors, descaling & disinfection",
  "Floors: machine scrubbing & mopping",
  "Windows, grills, doors & switchboards wiped",
  "Fans, lights & reachable ceiling cobwebs",
  "Trained, verified team with professional equipment & chemicals",
];

const AREAS = [
  "Hadapsar", "Magarpatta", "Amanora", "Kharadi", "Viman Nagar", "Kalyani Nagar", "Koregaon Park", "Wagholi",
  "Mundhwa", "Kondhwa", "NIBM", "Undri", "Wanowrie", "Camp", "Baner", "Aundh", "Wakad", "Hinjewadi", "Pimple Saudagar", "Kothrud",
];

const FAQS = [
  { q: "How long does a full home deep clean take?", a: "Usually 5–8 hours depending on home size and condition. Larger homes may need a bigger team or two visits." },
  { q: "Do I need to provide materials or equipment?", a: "No. Our team brings all equipment and cleaning chemicals." },
  { q: "Is the final price fixed?", a: "Prices shown are indicative starting prices. Our office team confirms the exact amount after understanding your requirement." },
  { q: "Is there a minimum order?", a: `Yes — the minimum job value is ${inr(COMPANY.minimumJobValue)}.` },
  { q: "Do you also do painting and pest control?", a: "Yes. Combine painting or pest control with your festival cleaning — ask us on WhatsApp for a combined quote." },
  { q: "How do I book?", a: "Tap Book Now to fill the online booking form, or call / WhatsApp us directly." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: COMPANY.name,
  url: "https://www.saharacleaningservices.com",
  telephone: `+91${CALL_NUMBER}`,
  email: COMPANY.email,
  address: { "@type": "PostalAddress", streetAddress: COMPANY.address, addressLocality: "Pune", addressCountry: "IN" },
  areaServed: AREAS.map((a) => `${a}, Pune`),
};

export default function OffersLandingPage() {
  return (
    <div className="min-h-screen bg-[#eef4fb] pb-20 text-[#0a2540] sm:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <span className="font-serif text-lg font-bold italic text-primary">Sahara Cleaning Services</span>
          <div className="hidden items-center gap-2 sm:flex">
            <a href={`tel:+91${CALL_NUMBER}`} className="flex items-center gap-1.5 rounded-xl border border-primary px-3 py-2 text-xs font-semibold text-primary">
              <Phone className="size-4" /> {CALL_NUMBER}
            </a>
            <BookButton className="!px-4 !py-2 !text-xs" />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="sahara-gradient text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
          <div>
            <p className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Sparkles className="size-3.5" /> Festival Season Offers</p>
            <h1 className="mt-3 font-serif text-3xl font-bold italic leading-tight sm:text-4xl">Festival-Ready Home Deep Cleaning in Pune</h1>
            <p className="mt-3 text-white/85">Kitchen, bathrooms, sofas and the whole home — cleaned by Sahara&apos;s trained team. Transparent pricing, no surprises.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={BOOK_URL} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primary shadow-lg">Book Now</a>
              <a href={toWhatsAppLink(WHATSAPP_NUMBER)} target="_blank" rel="noreferrer" className="rounded-full border border-white/70 px-6 py-3 text-sm font-bold">WhatsApp Us</a>
            </div>
          </div>
          <ImageSlot label="Hero" ratio="4 / 3" className="border-white/40 bg-white/10 text-white/80" />
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        {/* Offers */}
        <section id="offers">
          <h2 className="text-center text-2xl font-bold">Festival Offers</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {OFFERS.map((o) => (
              <div key={o.title} className="rounded-2xl bg-white p-4 shadow-sm">
                <ImageSlot label={o.slot} ratio="16 / 10" />
                <h3 className="mt-3 font-bold">{o.title}</h3>
                <p className="mt-1 text-sm text-[#0a2540]/70">{o.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Transparent Pricing */}
        <section id="pricing">
          <h2 className="text-center text-2xl font-bold">Transparent Pricing</h2>
          <p className="mt-1 text-center text-sm text-[#0a2540]/70">Indicative starting prices. Final amount confirmed by our office team.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {HOME_CLEANING_PACKAGES.map((p) => (
              <div key={p} className="rounded-2xl border-2 border-primary/20 bg-white p-5 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Full Home Cleaning</p>
                <h3 className="mt-1 text-xl font-bold">{p}</h3>
                <p className="mt-2 text-sm text-[#0a2540]/70">Price by home size (1–5 BHK, Villa)</p>
                <BookButton className="mt-4 !px-5 !py-2" />
              </div>
            ))}
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
            {PRICES.map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 text-sm last:border-0">
                <span className="font-medium">{p.name}</span>
                <span className="text-right font-bold text-primary">{p.price}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-center text-xs text-[#0a2540]/60">Minimum job value {inr(COMPANY.minimumJobValue)}.</p>
        </section>

        {/* What's Included */}
        <section id="included" className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">What&apos;s Included</h2>
            <ul className="mt-4 space-y-2">
              {INCLUDED.map((i) => (
                <li key={i} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-success" /> {i}</li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ImageSlot label="Kitchen" ratio="1 / 1" />
            <ImageSlot label="Bathroom" ratio="1 / 1" />
            <ImageSlot label="Painting" ratio="1 / 1" />
            <ImageSlot label="Pest control" ratio="1 / 1" />
          </div>
        </section>

        {/* Before / After */}
        <section id="before-after">
          <h2 className="text-center text-2xl font-bold">Before &amp; After</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 shadow-sm">
                <ImageSlot label={`Before ${n}`} ratio="3 / 4" />
                <ImageSlot label={`After ${n}`} ratio="3 / 4" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm"><a href="/gallery" className="font-semibold text-primary underline">See more of our work →</a></p>
        </section>

        {/* Trust / Reviews */}
        <section id="reviews">
          <h2 className="text-center text-2xl font-bold">Why Pune Trusts Sahara</h2>
          <div className="mt-6 grid gap-4 text-center sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 shadow-sm"><ShieldCheck className="mx-auto size-7 text-primary" /><p className="mt-2 font-bold">Verified, trained team</p></div>
            <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-2xl font-bold text-primary">{COMPANY.teamSize}+</p><p className="font-bold">In-house staff</p></div>
            <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm font-bold">GST registered</p><p className="text-xs text-[#0a2540]/60">GSTIN {COMPANY.gstin}</p></div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} data-review-slot={n} className="rounded-2xl border-2 border-dashed border-primary/30 bg-white p-5">
                <div className="flex gap-0.5 text-warning">{[...Array(5)].map((_, i) => <Star key={i} className="size-4 fill-current" />)}</div>
                <p className="mt-2 text-sm italic text-[#0a2540]/50">Customer review {n} — paste a real Google review here.</p>
              </div>
            ))}
          </div>
        </section>

        {/* Areas Served */}
        <section id="areas">
          <h2 className="text-center text-2xl font-bold">Areas We Serve in Pune</h2>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {AREAS.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm"><MapPin className="size-3 text-primary" /> {a}</span>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold">Frequently Asked Questions</h2>
          <div className="mt-5 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-2xl bg-white p-4 shadow-sm">
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mt-2 text-sm text-[#0a2540]/70">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Call / WhatsApp / Book */}
        <section id="contact" className="sahara-gradient rounded-3xl px-6 py-10 text-center text-white">
          <h2 className="text-2xl font-bold">Get Your Home Festival-Ready</h2>
          <p className="mt-1 text-white/85">{COMPANY.address}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={BOOK_URL} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-primary">Book Now</a>
            <a href={`tel:+91${CALL_NUMBER}`} className="rounded-full border border-white/70 px-6 py-3 text-sm font-bold">Call {CALL_NUMBER}</a>
            <a href={toWhatsAppLink(WHATSAPP_NUMBER)} target="_blank" rel="noreferrer" className="rounded-full bg-success px-6 py-3 text-sm font-bold">WhatsApp {WHATSAPP_NUMBER}</a>
          </div>
        </section>
      </main>

      {/* Mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-border bg-white text-center text-xs font-bold sm:hidden">
        <a href={`tel:+91${CALL_NUMBER}`} className="py-3 text-primary">Call</a>
        <a href={toWhatsAppLink(WHATSAPP_NUMBER)} target="_blank" rel="noreferrer" className="bg-success py-3 text-white">WhatsApp</a>
        <a href={BOOK_URL} className="bg-primary py-3 text-white">Book Now</a>
      </div>
    </div>
  );
}
