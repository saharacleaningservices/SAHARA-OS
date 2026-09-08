import { PageHeader } from "@/components/shared/page-header";
import { ReportsExplorer } from "@/components/reports/reports-explorer";
import { getReportsData } from "@/server/reports";
import { requireRole } from "@/lib/current-user";

export default async function ReportsPage() {
  await requireRole(["ADMIN", "OPERATIONS", "ACCOUNTS"]);
  const data = await getReportsData();

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Job history, photos, invoices, payments and certificates" />
      <ReportsExplorer jobs={data.jobs} photos={data.photos} payments={data.payments} certificates={data.certificates} />
    </div>
  );
}
