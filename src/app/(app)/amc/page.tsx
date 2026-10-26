import { PageHeader } from "@/components/shared/page-header";
import { AmcExplorer } from "@/components/amc/amc-explorer";
import { getAmcList } from "@/server/amc";
import { requireRole } from "@/lib/current-user";
import { canManageAmc, canSeeCustomerContact, canViewJobAmount } from "@/lib/permissions";

export default async function AmcPage() {
  // SUPERVISOR (Francis) removed 2026-09-21 — AMC isn't part of his narrowed module list.
  const session = await requireRole(["ADMIN", "OPERATIONS", "ACCOUNTS"]);
  const all = await getAmcList();
  // Owner rule 2026-10-08: customer number + contract amounts only for Super Admin / Accounts.
  const contracts = all.map((c) => ({
    ...c,
    ...(canSeeCustomerContact(session.role) ? {} : { customerMobile: "" }),
    ...(canViewJobAmount(session.role) ? {} : { amount: 0 }),
  }));
  const canManage = canManageAmc(session.role);

  return (
    <div className="space-y-6">
      <PageHeader title="AMC Contracts" description={`${contracts.length} annual maintenance contracts`} />
      <AmcExplorer contracts={contracts} canManage={canManage} />
    </div>
  );
}
