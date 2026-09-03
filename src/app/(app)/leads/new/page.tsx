import { PageHeader } from "@/components/shared/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { getStaffForAssignment } from "@/server/staff";

export default async function NewLeadPage() {
  const staffOptions = await getStaffForAssignment();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="New Lead" description="Capture a new enquiry into the pipeline." />
      <LeadForm staffOptions={staffOptions} />
    </div>
  );
}
