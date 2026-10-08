import { PageHeader } from "@/components/shared/page-header";
import { NewLeadForm } from "@/components/leads/lead-form";
import { getStaffForAssignment } from "@/server/staff";
import { getUsersForAssignment } from "@/server/users";
import { getResolvedIntegrations } from "@/server/integrations";
import { getSession } from "@/lib/session";
import { canEditPackagePricing } from "@/lib/package-calc";

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ mobile?: string; name?: string; book?: string }> }) {
  const sp = await searchParams;
  // "+ New Lead" from a customer page pre-fills and looks up the contact.
  const prefill = { mobile: (sp.mobile ?? "").replace(/\D/g, "").slice(-10), name: (sp.name ?? "").slice(0, 80) };
  // Dashboard "New Job": same single intake — the new lead opens on Confirm Booking.
  const book = sp.book === "1";
  const [staffOptions, userOptions, { googleMaps }, session] = await Promise.all([
    getStaffForAssignment(),
    getUsersForAssignment(),
    getResolvedIntegrations(),
    getSession(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={book ? "New Job" : "New Lead"} description={book ? "Customer, package and amount first — then confirm the date, slot and team." : "Capture a new enquiry into the pipeline."} />
      <NewLeadForm staffOptions={staffOptions} userOptions={userOptions} mapsApiKey={googleMaps.apiKey} canEditPricing={canEditPackagePricing(session?.role)} prefill={prefill.mobile.length === 10 ? prefill : undefined} book={book} />
    </div>
  );
}
