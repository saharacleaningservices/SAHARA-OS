import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { requireRole } from "@/lib/current-user";
import { getCompanySettings } from "@/server/settings";

export default async function SettingsPage() {
  await requireRole(["ADMIN"]);
  const settings = await getCompanySettings();

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
        }}
      />
    </div>
  );
}
