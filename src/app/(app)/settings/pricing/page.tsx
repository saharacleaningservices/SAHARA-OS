import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { getPricingAdminData } from "@/server/actions/pricing";
import { PricingManager } from "@/components/admin/pricing-manager";

export const metadata = { title: "Pricing & Packages — Sahara OS" };

export default async function PricingPage() {
  await requireRole(["ADMIN"]);
  const data = await getPricingAdminData();
  return (
    <div className="space-y-6">
      <PageHeader title="Pricing & Packages" description="Regular and festival prices for the landing pages, booking form and CRM — Super Admin only" />
      <PricingManager settings={data?.settings ?? []} festivals={data?.festivals ?? []} />
    </div>
  );
}
