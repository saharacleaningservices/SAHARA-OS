import { PageHeader } from "@/components/shared/page-header";
import { AssistantExplorer } from "@/components/assistant/assistant-explorer";
import { getAssistantOverview } from "@/server/assistant";

export default async function AssistantPage() {
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
        profitInputs={data.profitInputs}
      />
    </div>
  );
}
