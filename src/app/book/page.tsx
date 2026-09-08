import { PublicBookingForm } from "@/components/public/public-booking-form";
import { CompanyLogo } from "@/components/shared/company-logo";
import { COMPANY } from "@/lib/constants";
import { getResolvedIntegrations } from "@/server/integrations";
import { getCompanySettings } from "@/server/settings";

export const metadata = { title: "Book a Service — Sahara Cleaning Services" };

export default async function PublicBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const [{ googleMaps }, settings] = await Promise.all([
    getResolvedIntegrations(),
    getCompanySettings(),
  ]);

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <CompanyLogo logoUrl={settings.logoUrl} className="h-10 w-auto max-w-[220px]" />
          <h1 className="text-xl font-semibold text-foreground">Book a Service</h1>
          <p className="text-sm text-muted-foreground">{COMPANY.name} — Pune</p>
        </div>
        {ref && (
          <p className="rounded-lg bg-success/10 p-2 text-center text-xs font-medium text-success">
            Referred by a friend — code {ref} applied
          </p>
        )}
        <PublicBookingForm referralCode={ref} mapsApiKey={googleMaps.apiKey} />
        <p className="text-center text-xs text-muted-foreground">
          Or call/WhatsApp us directly at {COMPANY.phones[0]}.
        </p>
      </div>
    </div>
  );
}
