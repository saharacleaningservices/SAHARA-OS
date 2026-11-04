import { PageHeader } from "@/components/shared/page-header";
import { VendorsExplorer } from "@/components/vendors/vendors-explorer";
import { getVendorRegistry } from "@/server/vendors";
import { requireRole } from "@/lib/current-user";
import { SERVICE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  // Vendor commission + payouts are financial data: Super Admin + Accounts (as Expenses).
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const { vendors, payouts } = await getVendorRegistry();
  const active = vendors.filter((v) => v.active).length;
  return (
    <div className="space-y-6">
      <PageHeader title="Vendor Operations" description={`${active} active vendor${active === 1 ? "" : "s"} · Sahara commission 20–25 % · payouts booked as Vendor Payment expenses`} />
      <VendorsExplorer vendors={vendors} payouts={payouts} serviceOptions={Object.values(SERVICE_LABELS)} />
    </div>
  );
}
