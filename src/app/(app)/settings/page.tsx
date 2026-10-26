import { headers } from "next/headers";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { BackupsCard } from "@/components/settings/backups-card";
import { BusinessExportCard } from "@/components/settings/business-export-card";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import { CompanyDocumentsPanel } from "@/components/settings/company-documents-panel";
import { requireRole } from "@/lib/current-user";
import { getCompanySettings } from "@/server/settings";
import { getIntegrationStatusForUi } from "@/server/integrations";
import { getCompanyDocuments } from "@/server/actions/company-documents";
import { INTERNAL_CRM_HOST } from "@/lib/site-urls";
import { db } from "@/lib/db";

export default async function SettingsPage() {
  await requireRole(["ADMIN"]);
  const [settings, backupEvents, integrationStatus, companyDocs, hdrs] = await Promise.all([
    getCompanySettings(),
    db.backupEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getIntegrationStatusForUi(),
    getCompanyDocuments(),
    headers(),
  ]);
  const host = hdrs.get("host") ?? INTERNAL_CRM_HOST;
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
          googleRating: settings.googleRating ?? "",
          linkedinUrl: settings.linkedinUrl ?? "",
          signatureLogoWidth: settings.signatureLogoWidth ? String(settings.signatureLogoWidth) : "",
          signatureLogoHeight: settings.signatureLogoHeight ? String(settings.signatureLogoHeight) : "",
          googleReviewCount: settings.googleReviewCount ?? "",
          happyCustomers: settings.happyCustomers ?? "",
          featuredReviews: settings.featuredReviews ?? "",
          upiId: settings.upiId ?? "",
          upiQrUrl: settings.upiQrUrl ?? "",
          bankName: settings.bankName ?? "",
          bankAccountName: settings.bankAccountName ?? "",
          bankAccountNumber: settings.bankAccountNumber ?? "",
          bankIfsc: settings.bankIfsc ?? "",
        }}
      />
      <IntegrationsPanel status={integrationStatus} />
      <CompanyDocumentsPanel documents={companyDocs} origin={origin} companyName={settings.name} />
      <BusinessExportCard />
      <BackupsCard events={backupEvents} />
    </div>
  );
}
