import { PageHeader } from "@/components/shared/page-header";
import { NewLeadForm } from "@/components/leads/lead-form";
import { getStaffForAssignment } from "@/server/staff";
import { getUsersForAssignment } from "@/server/users";
import { getResolvedIntegrations } from "@/server/integrations";
import { getSession } from "@/lib/session";
import { canEditPackagePricing } from "@/lib/package-calc";

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ mobile?: string; name?: string }> }) {
  const sp = await searchParams;
  // "+ New Lead" from a customer page pre-fills and looks up the contact.
  const prefill = { mobile: (sp.mobile ?? "").replace(/D/g, "").slice(-10), name: (sp.name ?? "").slice(0, 80) };
  const [staffOptions, userOptions, { googleMaps }, session] = await Promise.all([
    getStaffForAssignment(),
    getUsersForAssignment(),
    getResolvedIntegrations(),
    getSession(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="New Lead" description="Capture a new enquiry into the pipeline." />
      <NewLeadForm staffOptions={staffOptions} userOptions={userOptions} mapsApiKey={googleMaps.apiKey} canEditPricing={canEditPackagePricing(session?.role)} prefill={prefill.mobile.length === 10 ? prefill : undefined} />
    </div>
  );
}
