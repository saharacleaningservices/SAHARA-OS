import { PageHeader } from "@/components/shared/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { getStaffForAssignment } from "@/server/staff";
import { getUsersForAssignment } from "@/server/users";
import { getResolvedIntegrations } from "@/server/integrations";

export default async function NewLeadPage() {
  const [staffOptions, userOptions, { googleMaps }] = await Promise.all([
    getStaffForAssignment(),
    getUsersForAssignment(),
    getResolvedIntegrations(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="New Lead" description="Capture a new enquiry into the pipeline." />
      <LeadForm staffOptions={staffOptions} userOptions={userOptions} mapsApiKey={googleMaps.apiKey} />
    </div>
  );
}
