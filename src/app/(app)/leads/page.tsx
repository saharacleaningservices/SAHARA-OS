import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { LeadsExplorer } from "@/components/leads/leads-explorer";
import { LeadImportDialog } from "@/components/leads/lead-import-dialog";
import { getAllLeadsForList } from "@/server/leads";
import { getUsersForAssignment } from "@/server/users";

export default async function LeadsPage() {
  const [leads, userOptions] = await Promise.all([getAllLeadsForList(), getUsersForAssignment()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead CRM"
        description={`${leads.length} leads across the pipeline`}
        actions={
          <>
            <LeadImportDialog userOptions={userOptions} />
            <Button asChild>
              <Link href="/leads/new">
                <Plus className="size-4" /> New Lead
              </Link>
            </Button>
          </>
        }
      />
      <LeadsExplorer leads={leads} />
    </div>
  );
}
