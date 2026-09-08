import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { BackupsCard } from "@/components/settings/backups-card";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { requireRole } from "@/lib/current-user";
import { getCompanySettings } from "@/server/settings";
import { getIntegrationStatusForUi } from "@/server/integrations";
import { isMyBillBookConfigured } from "@/lib/mybillbook";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  await requireRole(["ADMIN"]);
  const [settings, backupEvents, integrationStatus] = await Promise.all([
    getCompanySettings(),
    db.backupEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getIntegrationStatusForUi(),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Company profile and integrations for Sahara OS." />
      <SettingsForm
        defaultValues={{
          name: settings.name,
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
          logoUrl: settings.logoUrl ?? "",
          googleReviewUrl: settings.googleReviewUrl ?? "",
        }}
      />
      <IntegrationsPanel status={integrationStatus} mybillbookConfigured={isMyBillBookConfigured()} />
      <BackupsCard events={backupEvents} />
    </div>
  );
}
