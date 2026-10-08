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
import { redactLead } from "@/lib/redact";
import { formatINR } from "@/lib/utils";

export default async function LeadsPage() {
  const session = await requireUser();
  // Field roles see a scoped list (server/leads.ts fieldLeadWhere) and no bulk import.
  const isSupervisor = session.role === "SUPERVISOR" || session.role === "OPERATIONS";
  const [leads, userOptions, stats] = await Promise.all([
    getAllLeadsForList(session),
    getUsersForAssignment(),
    getLeadsPageStats(),
  ]);
  const showRevenue = canViewRevenue(session.role);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lead CRM"
        description={
          session.role === "OPERATIONS"
            ? `${leads.length} new, assigned & today/tomorrow leads`
            : isSupervisor
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

      {/* Phone: one compact strip instead of four tall cards. */}
      <div className="grid grid-cols-4 divide-x rounded-xl border bg-card text-center sm:hidden">
        {[
          ["/jobs?when=today", "Jobs today", String(stats.todayJobs)],
          ["/leads?due=today", "Follow-ups", String(stats.todayFollowUps)],
          ["/leads?due=overdue", "Overdue", String(stats.overdueFollowUps)],
          ...(showRevenue ? [["/payments", "Revenue", formatINR(stats.todayRevenue)]] : []),
        ].map(([href, label, value]) => (
          <Link key={label} href={href} className="px-1 py-2">
            <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="truncate text-sm font-bold">{value}</p>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 max-sm:hidden sm:grid-cols-4">
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

      <LeadsExplorer leads={leads.map((l) => redactLead(l, session.role))} />
    </div>
  );
}
