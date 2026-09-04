import { PageHeader } from "@/components/shared/page-header";
import { JobsExplorer } from "@/components/jobs/jobs-explorer";
import { NewJobDialog } from "@/components/jobs/new-job-dialog";
import { getAllJobsForList } from "@/server/jobs";
import { getStaffForAssignment } from "@/server/staff";
import { requireUser } from "@/lib/current-user";

export default async function JobsPage() {
  const session = await requireUser();
  const [jobs, staffOptions] = await Promise.all([getAllJobsForList(session), getStaffForAssignment()]);
  const canManage = session.role === "ADMIN" || session.role === "OPERATIONS";

  const scopeNote =
    session.role === "OPERATIONS"
      ? "Today & tomorrow"
      : session.role === "SUPERVISOR"
        ? "Your team"
        : session.role === "STAFF"
          ? "Your job today"
          : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Management"
        description={`${jobs.length} jobs tracked${scopeNote ? ` · ${scopeNote}` : ""}`}
        actions={canManage ? <NewJobDialog staffOptions={staffOptions} /> : undefined}
      />
      <JobsExplorer jobs={jobs} canManage={canManage} />
    </div>
  );
}
