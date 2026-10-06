import { PageHeader } from "@/components/shared/page-header";
import { CustomerImportDialog } from "@/components/customers/customer-import-dialog";
import { CustomersExplorer } from "@/components/customers/customers-explorer";
import { getCustomersList } from "@/server/customers";
import { requireRole } from "@/lib/current-user";
import { canExportCustomers } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";

export default async function CustomersPage() {
  // Full Customers database access (import, export, WhatsApp offer/
  // campaign) is ADMIN/ACCOUNTS/OPERATIONS — the owner's 2026-09-21 final
  // role policy grants Shoyab the same operational Customers access as
  // Altaf. SUPERVISOR (Francis) was removed the same day by an explicit
  // "IMPORTANT POLICY OVERRIDE": Francis must not have unrestricted access
  // to the Customers database — he still reaches the customer information
  // tied to his own today/tomorrow leads/jobs via those pages directly.
  // canExportCustomers is the one shared permission check for this
  // (src/lib/permissions.ts) — this page previously had its own separate,
  // narrower ADMIN/ACCOUNTS-only literal that silently disagreed with it.
  const session = await requireRole(["ADMIN", "ACCOUNTS"]);
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
      {/* WhatsApp campaigns (audience / template / sending) are Super Admin only — owner rule 2026-10-06. */}
      <CustomersExplorer customers={customers} canCampaign={session.role === "ADMIN"} />
    </div>
  );
}
