import { PageHeader } from "@/components/shared/page-header";
import { CustomerImportDialog } from "@/components/customers/customer-import-dialog";
import { CustomersExplorer } from "@/components/customers/customers-explorer";
import { getCustomersList } from "@/server/customers";
import { requireRole } from "@/lib/current-user";
import { formatINR } from "@/lib/utils";

export default async function CustomersPage() {
  // "Customers: Full" access is ADMIN + ACCOUNTS (see src/lib/constants.ts
  // ROLE_NAV_ACCESS and src/lib/permissions.ts canExportCustomers) — OPERATIONS
  // was previously allowed onto this page directly by URL even though the nav
  // matrix never grants it the "customers" section.
  const session = await requireRole(["ADMIN", "ACCOUNTS"]);
  const customers = await getCustomersList();
  const canManage = session.role === "ADMIN" || session.role === "ACCOUNTS";
  const outstanding = customers.reduce((s, c) => s + (c.outstanding ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${customers.length} customers · ${formatINR(outstanding)} outstanding`}
        actions={canManage ? <CustomerImportDialog /> : null}
      />
      <CustomersExplorer customers={customers} canCampaign={canManage} />
    </div>
  );
}
