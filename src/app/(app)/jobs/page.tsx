import Link from "next/link";
import { ClipboardList, CalendarClock, Clock, CheckCircle2, Wallet, Route } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { JobsExplorer } from "@/components/jobs/jobs-explorer";
import { NewJobDialog } from "@/components/jobs/new-job-dialog";
import { getAllJobsForList, getJobsPageStats } from "@/server/jobs";
import { getStaffForAssignment } from "@/server/staff";
import { requireUser } from "@/lib/current-user";
import { canViewRevenue } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";

export default async function JobsPage() {
  const session = await requireUser();
  const canManage = session.role === "ADMIN" || session.role === "OPERATIONS" || session.role === "ACCOUNTS";
  const [jobs, staffOptions, stats] = await Promise.all([
    getAllJobsForList(session),
    getStaffForAssignment(),
    canManage ? getJobsPageStats() : Promise.resolve(null),
  ]);
  const showRevenue = canViewRevenue(session.role);

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
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/jobs/dispatch">
                <Route className="size-4" /> Team Dispatch
              </Link>
            </Button>
            {canManage && <NewJobDialog staffOptions={staffOptions} />}
          </>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Link href="/jobs?when=today">
            <StatCard label="Today Jobs" value={stats.todayJobs} icon={<ClipboardList className="size-4" />} tone="primary" />
          </Link>
          <Link href="/jobs?when=tomorrow">
            <StatCard label="Tomorrow Jobs" value={stats.tomorrowJobs} icon={<CalendarClock className="size-4" />} />
          </Link>
          <Link href="/jobs?status=PENDING">
            <StatCard label="Pending Jobs" value={stats.pendingJobs} icon={<Clock className="size-4" />} tone="warning" />
          </Link>
          <Link href="/jobs?status=COMPLETED">
            <StatCard label="Completed Today" value={stats.completedToday} icon={<CheckCircle2 className="size-4" />} tone="success" />
          </Link>
          {showRevenue && (
            <Link href="/payments">
              <StatCard label="Pending Payments" value={formatINR(stats.pendingPayments)} icon={<Wallet className="size-4" />} tone="warning" />
            </Link>
          )}
        </div>
      )}

      <JobsExplorer jobs={jobs} canManage={canManage} />
    </div>
  );
}
