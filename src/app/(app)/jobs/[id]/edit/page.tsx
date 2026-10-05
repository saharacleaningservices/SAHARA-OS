import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { JobEditForm } from "@/components/jobs/job-edit-form";
import { getJobDetail, getOwnStaffId, canAccessJob } from "@/server/jobs";
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
  // Francis (SUPERVISOR) final policy, 2026-09-21: "Edit ... only for TODAY
  // and TOMORROW" — canManageJobs alone is a role-level check and doesn't
  // enforce this; a direct URL to a past/future job's edit page must still
  // be blocked here, same as the job detail page already does.
  const ownStaffId = await getOwnStaffId(session.sub);
  if (!canAccessJob(session, job, ownStaffId)) redirect(`/jobs/${id}`);

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
          scopeOfWork: job.scopeOfWork ?? "",
        }}
      />
    </div>
  );
}
