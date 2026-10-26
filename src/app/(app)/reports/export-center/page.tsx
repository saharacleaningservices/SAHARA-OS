import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { ExportCenter } from "@/components/reports/export-center";
import { FyReports } from "@/components/reports/fy-reports";
import { fyLabel, fyOptions } from "@/lib/fy";

export const metadata = { title: "Export Center — Sahara OS" };

export default async function ExportCenterPage() {
  // Same gate as salary figures (canViewSalary): Super Admin + Accounts.
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 2023 }, (_, i) => thisYear - i);
  return (
    <div className="space-y-6">
      <PageHeader title="Export Center" description="Month / year Excel export — sales, purchase, expenses, attendance, salary, advance, fines, rewards, jobs & customers" />
      <FyReports options={fyOptions().map((v) => ({ value: v, label: fyLabel(v) }))} />
      <ExportCenter years={years} />
    </div>
  );
}
