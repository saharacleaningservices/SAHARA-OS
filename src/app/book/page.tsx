import Link from "next/link";
import { Phone, MessageCircle, Globe, ShieldCheck, BadgeCheck, Lock, IndianRupee, Sparkles, Clock3, Award } from "lucide-react";
import { FaInstagram, FaFacebookF } from "react-icons/fa6";
import { PublicBookingForm } from "@/components/public/public-booking-form";
import { BookingFloatingContacts } from "@/components/public/booking-floating-contacts";
import { CompanyLogo } from "@/components/shared/company-logo";
import { COMPANY } from "@/lib/constants";
import { getResolvedIntegrations } from "@/server/integrations";
import { getCompanySettings } from "@/server/settings";
import { toTelLink, toWhatsAppLink } from "@/lib/utils";

export const metadata = {
  title: "Book a Service — Sahara Cleaning Services, Pune",
  description: "Pune's trusted deep cleaning experts — Home, Office, Pest Control & Interior Painting.",
};

const CALL_NUMBER = "7083347130";
const WHATSAPP_NUMBER = "8956567130";

export default async function PublicBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; source?: string; src?: string }>;
}) {
  const { ref, source, src } = await searchParams;
  const [{ googleMaps }, settings] = await Promise.all([
    getResolvedIntegrations(),
    getCompanySettings(),
  ]);
  const leadSource = (source || src || "").toUpperCase();
  const website = settings.website || COMPANY.website;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden text-white">
        <div className="absolute inset-0 sahara-gradient" />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #ffffff 0, transparent 45%), radial-gradient(circle at 80% 0%, #ffffff 0, transparent 40%), radial-gradient(circle at 60% 90%, #ffffff 0, transparent 35%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-8 sm:pb-14 sm:pt-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="rounded-xl bg-white/95 px-3 py-2 shadow-lg">
              <CompanyLogo logoUrl={settings.logoUrl} className="h-9 w-auto max-w-[200px]" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                {COMPANY.name}
                <sup className="ml-0.5 text-[0.6em]">™</sup>
              </h1>
              <p className="text-sm text-white/80">Pune</p>
            </div>

            {/* contact + social row */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
              <a href={toTelLink(CALL_NUMBER)} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">
                <Phone className="size-3.5" /> {CALL_NUMBER}
              </a>
              <a href={toWhatsAppLink(WHATSAPP_NUMBER)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">
                <MessageCircle className="size-3.5" /> WhatsApp
              </a>
              <a href={`https://instagram.com/saharacleaningservices`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">
                <FaInstagram className="size-3.5" /> Instagram
              </a>
              <a href={`https://facebook.com/saharacleaningservices`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">
                <FaFacebookF className="size-3.5" /> Facebook
              </a>
              <a href={`https://${website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 hover:bg-white/25">
                <Globe className="size-3.5" /> {website}
              </a>
            </div>

            <h2 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
              Pune&apos;s Trusted Deep Cleaning Experts
            </h2>
            <p className="text-sm text-white/85 sm:text-base">
              Home • Office • Pest Control • Interior Painting
            </p>
          </div>
        </div>
      </header>

      {/* ── Trust strip ──────────────────────────────────────────── */}
      <div className="bg-success text-success-foreground">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-4 py-2.5 text-[11px] font-semibold sm:text-xs">
          <span className="flex items-center gap-1.5"><Lock className="size-3.5" /> SSL Secure</span>
          <span className="flex items-center gap-1.5"><BadgeCheck className="size-3.5" /> Verified Business</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> GST Registered</span>
          <span className="flex items-center gap-1.5"><IndianRupee className="size-3.5" /> No Hidden Charges</span>
        </div>
      </div>

      {/* ── Booking form ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-xl px-4 py-8">
        {/* urgency banner */}
        <div className="mb-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-center text-xs font-semibold text-success">
          ⚡ Today&apos;s slots are filling fast — book now to lock your preferred time.
        </div>

        {ref && (
          <p className="mb-4 rounded-lg bg-accent p-2 text-center text-xs font-medium text-accent-foreground">
            Referred by a friend — code {ref} applied
          </p>
        )}

        <PublicBookingForm referralCode={ref} mapsApiKey={googleMaps.apiKey} leadSource={leadSource} />

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Price will be shared after quotation. Or call / WhatsApp us directly at {CALL_NUMBER}.
        </p>

        {/* ── Why choose Sahara ─────────────────────────────────── */}
        <section className="mt-10">
          <h3 className="mb-3 text-center text-base font-bold text-foreground">Why Choose Sahara?</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Sparkles, label: "Trained Team" },
              { icon: ShieldCheck, label: "Safe Chemicals" },
              { icon: Clock3, label: "On-Time Service" },
              { icon: Award, label: "Premium Quality" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 sahara-shadow">
                <Icon className="size-5 shrink-0 text-primary" />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">Staff login</Link>
        </footer>
      </main>

      <BookingFloatingContacts callNumber={CALL_NUMBER} whatsappNumber={WHATSAPP_NUMBER} />
    </div>
  );
}
