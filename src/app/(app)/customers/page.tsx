import { PageHeader } from "@/components/shared/page-header";
import { CustomerImportDialog } from "@/components/customers/customer-import-dialog";
import { CustomersExplorer } from "@/components/customers/customers-explorer";
import { getCustomersList } from "@/server/customers";
import { requireRole } from "@/lib/current-user";
import { canExportCustomers } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";

export default async function CustomersPage() {
  // Full Customers access (import, export, WhatsApp offer/campaign) is
  // ADMIN/ACCOUNTS/OPERATIONS/SUPERVISOR — the owner's 2026-09-21 final
  // role policy grants Shoyab/Francis the same operational Customers
  // access as Altaf. canExportCustomers is the one shared permission check
  // for this (src/lib/permissions.ts) — this page previously had its own
  // separate, narrower ADMIN/ACCOUNTS-only literal that silently disagreed
  // with it, hiding Import and Send Offer for OPERATIONS/SUPERVISOR.
  const session = await requireRole(["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"]);
  const customers = await getCustomersList();
  const canManage = canExportCustomers(session.role);
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
