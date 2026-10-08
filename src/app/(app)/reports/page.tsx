import { PageHeader } from "@/components/shared/page-header";
import { ReportsExplorer } from "@/components/reports/reports-explorer";
import { getReportsData } from "@/server/reports";
import { requireRole } from "@/lib/current-user";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  // SUPERVISOR (Francis) removed 2026-09-21 — Reports isn't part of his
  // narrowed module list, and ROLE_NAV_ACCESS no longer grants him
  // "reports" either; this must match it exactly (defense in depth).
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const data = await getReportsData();

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" description="Job history, photos, invoices, payments and certificates" />
      <ReportsExplorer jobs={data.jobs} photos={data.photos} payments={data.payments} certificates={data.certificates} reviews={data.reviews} initialTab={tab} />
    </div>
  );
}
