import Link from "next/link";
import { Plus, ClipboardList, BellRing, AlertTriangle, IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { LeadsExplorer } from "@/components/leads/leads-explorer";
import { LeadImportDialog } from "@/components/leads/lead-import-dialog";
import { getAllLeadsForList, getLeadsPageStats } from "@/server/leads";
import { getUsersForAssignment } from "@/server/users";
import { requireUser } from "@/lib/current-user";
import { canViewRevenue } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";

export default async function LeadsPage() {
  const session = await requireUser();
  const isSupervisor = session.role === "SUPERVISOR";
  const [leads, userOptions, stats] = await Promise.all([
    getAllLeadsForList(session),
    getUsersForAssignment(),
    getLeadsPageStats(),
  ]);
  const showRevenue = canViewRevenue(session.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead CRM"
        description={
          isSupervisor
            ? `${leads.length} today/tomorrow leads & active enquiries`
            : `${leads.length} leads across the pipeline`
        }
        actions={
          <>
            {/* Bulk import is an administrative action, not day-to-day
                today/tomorrow operational editing — hidden for Francis
                (SUPERVISOR), per his 2026-09-21 final policy. */}
            {!isSupervisor && <LeadImportDialog userOptions={userOptions} />}
            <Button asChild>
              <Link href="/leads/new">
                <Plus className="size-4" /> New Lead
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/jobs?when=today">
          <StatCard label="Today Jobs" value={stats.todayJobs} icon={<ClipboardList className="size-4" />} tone="primary" />
        </Link>
        <Link href="/leads?due=today">
          <StatCard label="Today Follow-ups" value={stats.todayFollowUps} icon={<BellRing className="size-4" />} />
        </Link>
        <Link href="/leads?due=overdue">
          <StatCard label="Overdue" value={stats.overdueFollowUps} icon={<AlertTriangle className="size-4" />} tone="warning" />
        </Link>
        {showRevenue && (
          <Link href="/payments">
            <StatCard label="Today's Revenue" value={formatINR(stats.todayRevenue)} icon={<IndianRupee className="size-4" />} tone="success" />
          </Link>
        )}
      </div>

      <LeadsExplorer leads={leads} />
    </div>
  );
}
