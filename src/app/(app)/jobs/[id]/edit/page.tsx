import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { JobEditForm } from "@/components/jobs/job-edit-form";
import { getJobDetail } from "@/server/jobs";
import { getStaffForAssignment } from "@/server/staff";
import { requireUser } from "@/lib/current-user";
import { canManageJobs } from "@/lib/permissions";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  // Full job edit form is manager-only. Field roles progress the job and add
  // notes/remarks from the job detail page instead.
  if (!canManageJobs(session.role)) redirect(`/jobs/${id}`);
  const [job, staffOptions] = await Promise.all([getJobDetail(id), getStaffForAssignment()]);
  if (!job) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Edit ${job.customerName}`} description={job.jobNumber} />
      <JobEditForm
        jobId={job.id}
        staffOptions={staffOptions}
        defaultStaffIds={job.assignments.map((a) => a.staffId)}
        defaultValues={{
          customerName: job.customerName,
          customerMobile: job.customerMobile,
          address: job.address,
          area: job.area,
          pinCode: job.pinCode ?? "",
          serviceVariant: job.serviceVariant ?? "",
          packageName: job.packageName ?? "",
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
