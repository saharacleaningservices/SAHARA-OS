import { PageHeader } from "@/components/shared/page-header";
import { CustomerImportDialog } from "@/components/customers/customer-import-dialog";
import { CustomersExplorer } from "@/components/customers/customers-explorer";
import { getCustomersPage } from "@/server/customers";
import { requireRole } from "@/lib/current-user";
import { canExportCustomers } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  // Full Customers database access (import, export, WhatsApp offer/
  // campaign) is ADMIN/ACCOUNTS only. Francis (Operations) reaches the
  // customer information tied to his own leads/jobs via those pages directly.
  const session = await requireRole(["ADMIN", "ACCOUNTS"]);
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const data = await getCustomersPage({ q, filter: sp.filter, page: Number(sp.page) || 1, pageSize: 25 });
  const canManage = canExportCustomers(session.role);
  // Only what the list shows — site search text never leaves the server.
  const rows = data.rows.map((r) => ({
    mobile: r.mobile, name: r.name, leadCount: r.leadCount, jobCount: r.jobCount, revenue: r.revenue, lastActivity: r.lastActivity,
    area: r.area, outstanding: r.outstanding, contactType: r.contactType, isRepeat: r.isRepeat, siteCount: r.siteCount, variants: r.variants,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description={`${data.allCount} contacts · ${formatINR(data.outstanding)} outstanding`}
        actions={canManage ? <CustomerImportDialog /> : null}
      />
      {/* WhatsApp campaigns (audience / template / sending) are Super Admin only — owner rule 2026-10-06. */}
      <CustomersExplorer
        rows={rows}
        total={data.total}
        counts={data.counts}
        page={data.page}
        totalPages={data.totalPages}
        filter={data.filter}
        q={q}
        canCampaign={session.role === "ADMIN"}
      />
    </div>
  );
}
