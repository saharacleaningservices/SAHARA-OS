import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { getLeadDetail } from "@/server/leads";
import { getStaffForAssignment } from "@/server/staff";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, staffOptions] = await Promise.all([getLeadDetail(id), getStaffForAssignment()]);
  if (!lead) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Edit ${lead.name}`} description={lead.leadNumber} />
      <LeadForm
        leadId={lead.id}
        staffOptions={staffOptions}
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
          notes: lead.notes ?? "",
        }}
      />
    </div>
  );
}
