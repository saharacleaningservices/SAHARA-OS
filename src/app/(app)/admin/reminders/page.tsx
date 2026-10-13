import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/current-user";
import { getOpsReminderAdmin } from "@/server/actions/ops-reminders";
import { OpsReminderSettingsForm } from "@/components/admin/ops-reminder-settings";

export const dynamic = "force-dynamic";

export default async function ReminderSettingsPage() {
  await requireRole(["ADMIN"]);
  const data = await getOpsReminderAdmin();
  if (!data) redirect("/dashboard");
  const { settings, history, totals } = data;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Reminders & alerts"
        description={`Job-closure and payment-collection reminders for Accounts, escalation to the Super Admin, daily summary. Open now: ${totals.jobClosures} closures · ${totals.payments} unpaid.`}
      />
      <OpsReminderSettingsForm
        initial={{
          enabled: settings.enabled,
          jobIntervalMin: settings.jobIntervalMin,
          paymentIntervalMin: settings.paymentIntervalMin,
          escalateAfterMin: settings.escalateAfterMin,
          defaultJobHours: settings.defaultJobHours,
          paymentLookbackDays: settings.paymentLookbackDays,
          quietStart: settings.quietStart,
          quietEnd: settings.quietEnd,
          soundEnabled: settings.soundEnabled,
          maxSnoozeMin: settings.maxSnoozeMin,
          dailySummaryHour: settings.dailySummaryHour,
          staffSignupNeedsApproval: settings.staffSignupNeedsApproval,
        }}
        updatedBy={settings.updatedByName}
        history={history}
      />
    </div>
  );
}
