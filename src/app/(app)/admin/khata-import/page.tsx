import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { listKhataBatches } from "@/server/actions/khata-import";
import { KhataImportManager } from "@/components/admin/khata-import-manager";

export const metadata = { title: "Khata Book Import — Sahara OS" };
export const dynamic = "force-dynamic";

export default async function KhataImportPage() {
  await requireRole(["ADMIN"]);
  const batches = await listKhataBatches();
  return (
    <div className="space-y-6">
      <PageHeader title="Khata Book → Staff App import" description="Super Admin only · preview, snapshot, ₹0 reconciliation, rollback" />
      <KhataImportManager batches={batches} />
    </div>
  );
}
