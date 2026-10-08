import Link from "next/link";
import { ClipboardList, CalendarClock, Clock, CheckCircle2, Wallet, Route } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { JobsExplorer } from "@/components/jobs/jobs-explorer";
import { getAllJobsForList, getJobsPageStats, jobDateWindowForRole } from "@/server/jobs";
import { requireUser } from "@/lib/current-user";
import { canSeeCustomerContact as canSeeContact, canViewJobAmount, canViewRevenue } from "@/lib/permissions";
import { redactJob } from "@/lib/redact";
import { formatINR } from "@/lib/utils";

export default async function JobsPage() {
  const session = await requireUser();
  const canManage = session.role === "ADMIN" || session.role === "OPERATIONS" || session.role === "ACCOUNTS";
  // Customer phone / Call / WhatsApp: Super Admin + Accounts only (owner rule 2026-10-08).
  const canSeeCustomerContact = canSeeContact(session.role);
  // Jobs are created only from Leads → Confirm Booking (single intake), so no staff list is needed here.
  // Time-scoped roles (Francis) get counts for their own window only — never all-time numbers.
  const jobWindow = jobDateWindowForRole(session.role);
  const [jobs, stats] = await Promise.all([getAllJobsForList(session), canManage ? getJobsPageStats(jobWindow) : Promise.resolve(null)]);
  // Job amount / paid / balance per job — no revenue totals, profit or costs.
  const showRevenue = canViewJobAmount(session.role);
  // Restricted roles never receive customer contact or money figures, not even in the payload.
  const visibleJobs = jobs.map((j) => redactJob(j, session.role));

  const scopeNote =
    session.role === "OPERATIONS"
      ? "Yesterday, today & tomorrow"
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
            {canManage && (
              <Button asChild>
                <Link href="/jobs/slots">
                  <CalendarClock className="size-4" /> Slot Availability
                </Link>
              </Button>
            )}
          </>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {session.role === "OPERATIONS" && (
            <Link href="/jobs?when=yesterday">
              <StatCard label="Yesterday Jobs" value={stats.yesterdayJobs} icon={<ClipboardList className="size-4" />} />
            </Link>
          )}
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
          {/* Company-wide pending total is financial data — owner + Accounts only (never Francis). */}
          {canViewRevenue(session.role) && (
            <Link href="/payments">
              <StatCard label="Pending Payments" value={formatINR(stats.pendingPayments)} icon={<Wallet className="size-4" />} tone="warning" />
            </Link>
          )}
        </div>
      )}

      <JobsExplorer jobs={visibleJobs} canManage={canManage} canSeeCustomerContact={canSeeCustomerContact} showMoney={showRevenue} />
    </div>
  );
}
