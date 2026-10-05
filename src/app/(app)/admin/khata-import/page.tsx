import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { listKhataBatches } from "@/server/actions/khata-import";
import { KhataImportManager } from "@/components/admin/khata-import-manager";
import { previewEmployeeIdMaster } from "@/server/actions/employee-id-master";
import { EmployeeIdMasterCard } from "@/components/admin/employee-id-master-card";

export const metadata = { title: "Khata Book Import — Sahara OS" };
export const dynamic = "force-dynamic";

export default async function KhataImportPage() {
  await requireRole(["ADMIN"]);
  const [batches, idMaster] = await Promise.all([listKhataBatches(), previewEmployeeIdMaster()]);
  return (
    <div className="space-y-6">
      <PageHeader title="Khata Book → Staff App import" description="Super Admin only · preview, snapshot, ₹0 reconciliation, rollback" />
      {"rows" in idMaster && idMaster.rows && <EmployeeIdMasterCard rows={idMaster.rows} />}
      <KhataImportManager batches={batches} />
    </div>
  );
}
