import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { getLeadDetail } from "@/server/leads";
import { getStaffForAssignment } from "@/server/staff";
import { getUsersForAssignment } from "@/server/users";
import { getResolvedIntegrations } from "@/server/integrations";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lead, staffOptions, userOptions, { googleMaps }] = await Promise.all([
    getLeadDetail(id),
    getStaffForAssignment(),
    getUsersForAssignment(),
    getResolvedIntegrations(),
  ]);
  if (!lead) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Edit ${lead.name}`} description={lead.leadNumber} />
      <LeadForm
        leadId={lead.id}
        staffOptions={staffOptions}
        userOptions={userOptions}
        mapsApiKey={googleMaps.apiKey}
        defaultValues={{
          name: lead.name,
          mobile: lead.mobile,
          alternateMobile: lead.alternateMobile ?? "",
          whatsapp: lead.whatsapp ?? "",
          email: lead.email ?? "",
          address: lead.address ?? "",
          area: lead.area,
          pinCode: lead.pinCode ?? "",
          service: lead.service as never,
          source: lead.source as never,
          quoteAmount: lead.quoteAmount ?? undefined,
          followUpDate: lead.followUpDate ? lead.followUpDate.toISOString().slice(0, 10) : "",
          serviceDate: lead.serviceDate ? lead.serviceDate.toISOString().slice(0, 10) : "",
          timeSlot: lead.timeSlot ?? "",
          teamNumber: lead.teamNumber ?? "",
          assignedStaffId: lead.assignedStaffId ?? "",
          assignedStaffIds: lead.assignedStaffIds
            ? (JSON.parse(lead.assignedStaffIds) as string[])
            : lead.assignedStaffId
              ? [lead.assignedStaffId]
              : [],
          assignedToId: lead.assignedToId ?? "",
          notes: lead.notes ?? "",
          serviceCategory: lead.serviceCategory ?? "HOME_DEEP_CLEANING",
          serviceVariant: lead.serviceVariant ?? "",
          packageName: lead.packageName ?? "",
          comboServices: lead.comboServices ? (JSON.parse(lead.comboServices) as string[]) : [],
          mapLink: lead.mapLink ?? "",
        }}
      />
    </div>
  );
}
