import { headers } from "next/headers";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { BackupsCard } from "@/components/settings/backups-card";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { CompanyDocumentsPanel } from "@/components/settings/company-documents-panel";
import { MyBillBookCard } from "@/components/settings/mybillbook-card";
import { requireRole } from "@/lib/current-user";
import { getCompanySettings } from "@/server/settings";
import { getIntegrationStatusForUi, getResolvedIntegrations } from "@/server/integrations";
import { getCompanyDocuments } from "@/server/actions/company-documents";
import { isMyBillBookConfigured } from "@/lib/mybillbook";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  await requireRole(["ADMIN"]);
  const [settings, backupEvents, integrationStatus, resolved, companyDocs, hdrs] = await Promise.all([
    getCompanySettings(),
    db.backupEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getIntegrationStatusForUi(),
    getResolvedIntegrations(),
    getCompanyDocuments(),
    headers(),
  ]);
  const host = hdrs.get("host") ?? "app.saharacleaningservices.com";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Company profile and integrations for Sahara OS." />
      <SettingsForm
        defaultValues={{
          name: settings.name,
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
          website: settings.website ?? "",
          logoUrl: settings.logoUrl ?? "",
          googleReviewUrl: settings.googleReviewUrl ?? "",
        }}
      />
      <IntegrationsPanel status={integrationStatus} mybillbookConfigured={isMyBillBookConfigured()} />
      <MyBillBookCard configured={resolved.mybillbook.configured} source={resolved.mybillbook.source} />
      <CompanyDocumentsPanel documents={companyDocs} origin={origin} companyName={settings.name} />
      <BackupsCard events={backupEvents} />
    </div>
  );
}
