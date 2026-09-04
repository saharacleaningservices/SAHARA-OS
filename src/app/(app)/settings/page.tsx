import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { BackupsCard } from "@/components/settings/backups-card";
import { IntegrationsCard } from "@/components/settings/integrations-card";
import { requireRole } from "@/lib/current-user";
import { getCompanySettings } from "@/server/settings";
import { isWhatsAppConfigured } from "@/lib/whatsapp";
import { isMyBillBookConfigured } from "@/lib/mybillbook";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  await requireRole(["ADMIN"]);
  const [settings, backupEvents] = await Promise.all([
    getCompanySettings(),
    db.backupEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Company profile used across Sahara OS." />
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
      <IntegrationsCard whatsappConfigured={isWhatsAppConfigured()} mybillbookConfigured={isMyBillBookConfigured()} />
      <BackupsCard events={backupEvents} />
    </div>
  );
}
