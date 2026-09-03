import { PageHeader } from "@/components/shared/page-header";
import { JobsExplorer } from "@/components/jobs/jobs-explorer";
import { NewJobDialog } from "@/components/jobs/new-job-dialog";
import { getAllJobsForList } from "@/server/jobs";
import { getStaffForAssignment } from "@/server/staff";

export default async function JobsPage() {
  const [jobs, staffOptions] = await Promise.all([getAllJobsForList(), getStaffForAssignment()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Management"
        description={`${jobs.length} jobs tracked`}
        actions={<NewJobDialog staffOptions={staffOptions} />}
      />
      <JobsExplorer jobs={jobs} />
    </div>
  );
}
