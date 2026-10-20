import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { findClosableJobs } from "@/server/past-jobs-cleanup";
import { PastJobsCloser } from "@/components/admin/past-jobs-closer";
import { EmptyState } from "@/components/shared/empty-state";

export const dynamic = "force-dynamic";

// Admin only. Lists jobs whose service date has passed and that are fully paid but never marked Completed.
export default async function PastJobsCleanupPage() {
  await requireRole(["ADMIN"]);
  const rows = await findClosableJobs();
  return (
    <div className="space-y-4">
      <PageHeader title="Past jobs to close" description="Service date has passed, still open, and every payment is paid in full. Tick the ones that were done and mark them Completed — no customer messages are sent." />
      {rows.length === 0 ? <EmptyState title="Nothing to close" description="No past-dated, fully-paid jobs are waiting." /> : <PastJobsCloser rows={rows} />}
    </div>
  );
}
