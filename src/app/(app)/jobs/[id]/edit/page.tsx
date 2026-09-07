import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { JobEditForm } from "@/components/jobs/job-edit-form";
import { getJobDetail } from "@/server/jobs";
import { getStaffForAssignment } from "@/server/staff";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, staffOptions] = await Promise.all([getJobDetail(id), getStaffForAssignment()]);
  if (!job) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Edit ${job.customerName}`} description={job.jobNumber} />
      <JobEditForm
        jobId={job.id}
        staffOptions={staffOptions}
        defaultValues={{
          customerName: job.customerName,
          customerMobile: job.customerMobile,
          address: job.address,
          area: job.area,
          service: job.service as never,
          scheduledDate: job.scheduledDate.toISOString().slice(0, 10),
          scheduledTime: job.scheduledTime,
          teamNumber: job.teamNumber ?? "",
          supervisorId: job.supervisorId ?? "",
          jobValue: job.jobValue,
          notes: job.notes ?? "",
        }}
      />
    </div>
  );
}
