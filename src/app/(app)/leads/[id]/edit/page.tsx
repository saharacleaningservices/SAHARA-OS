import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { getLeadDetail } from "@/server/leads";
import { getStaffForAssignment } from "@/server/staff";
import { getUsersForAssignment } from "@/server/users";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, staffOptions, userOptions] = await Promise.all([
    getLeadDetail(id),
    getStaffForAssignment(),
    getUsersForAssignment(),
  ]);
  if (!lead) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Edit ${lead.name}`} description={lead.leadNumber} />
      <LeadForm
        leadId={lead.id}
        staffOptions={staffOptions}
        userOptions={userOptions}
        defaultValues={{
          name: lead.name,
          mobile: lead.mobile,
          whatsapp: lead.whatsapp ?? "",
          address: lead.address ?? "",
          area: lead.area,
          service: lead.service as never,
          source: lead.source as never,
          quoteAmount: lead.quoteAmount ?? undefined,
          followUpDate: lead.followUpDate ? lead.followUpDate.toISOString().slice(0, 10) : "",
          assignedStaffId: lead.assignedStaffId ?? "",
          assignedToId: lead.assignedToId ?? "",
          notes: lead.notes ?? "",
        }}
      />
    </div>
  );
}
