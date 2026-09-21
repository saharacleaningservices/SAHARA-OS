import { PageHeader } from "@/components/shared/page-header";
import { AmcExplorer } from "@/components/amc/amc-explorer";
import { getAmcList } from "@/server/amc";
import { requireRole } from "@/lib/current-user";
import { canManageAmc } from "@/lib/permissions";

export default async function AmcPage() {
  // SUPERVISOR (Francis) removed 2026-09-21 — AMC isn't part of his narrowed module list.
  const session = await requireRole(["ADMIN", "OPERATIONS", "ACCOUNTS"]);
  const contracts = await getAmcList();
  const canManage = canManageAmc(session.role);

  return (
    <div className="space-y-6">
      <PageHeader title="AMC Contracts" description={`${contracts.length} annual maintenance contracts`} />
      <AmcExplorer contracts={contracts} canManage={canManage} />
    </div>
  );
}
