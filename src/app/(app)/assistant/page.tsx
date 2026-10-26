import { PageHeader } from "@/components/shared/page-header";
import { AssistantExplorer } from "@/components/assistant/assistant-explorer";
import { getAssistantOverview } from "@/server/assistant";
import { requireRole } from "@/lib/current-user";

export default async function AssistantPage() {
  // This page had NO session/role check at all before — it surfaces
  // profitInputs and duePayments (financial data), and relied entirely on
  // middleware's nav-based gate. Francis (SUPERVISOR) is not in
  // ROLE_NAV_ACCESS for "assistant"; this page-level guard now matches
  // that explicitly, per the 2026-09-22 "enforce on route/page, not just
  // middleware" requirement.
  const session = await requireRole(["ADMIN", "ACCOUNTS"]);
  const data = await getAssistantOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        description="Local, rule-based suggestions generated from live data — nothing leaves your server."
      />
      <AssistantExplorer
        quotableLeads={data.quotableLeads}
        duePayments={data.duePayments}
        staffList={data.staffList}
        jobsNeedingCrew={data.jobsNeedingCrew}
        dueFollowUps={data.dueFollowUps}
        staleLeads={data.staleLeads}
        // Profit is Super Admin only (CLAUDE.md) — never sent to the Accounts browser.
        profitInputs={session.role === "ADMIN" ? data.profitInputs : null}
      />
    </div>
  );
}
