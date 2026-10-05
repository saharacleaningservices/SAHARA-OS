import Link from "next/link";
import { getStaffLang } from "@/server/staff-lang";
import { staffLocale, staffT } from "@/lib/staff-i18n";
import { KeyRound } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { Section } from "@/components/staff-app/ui";
import { PushControl } from "@/components/staff-app/push-control";
import { StaffLogoutButton } from "@/components/staff-app/logout-button";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { LanguageSwitcher } from "@/components/staff-app/language-switcher";
import { StaffPhotoUploader } from "@/components/staff/staff-photo-uploader";

export const dynamic = "force-dynamic";

export default async function StaffAccountPage() {
  const { staff, preview } = await requireMyStaff();
  if (!staff) return null;
  const lang = await getStaffLang();
  const t = staffT(lang);
  const rows: [string, string][] = [
    [t("staffId"), staff.employeeCode],
    [t("designation"), staff.designation],
    [t("mobile"), staff.mobile],
    [t("joined"), staff.joinedOn.toLocaleDateString(staffLocale(lang), { day: "numeric", month: "short", year: "numeric" })],
  ];
  return (
    <div className="space-y-4">
      <LanguageSwitcher lang={lang} />
      <Section>
        <div className="flex items-center gap-3">
          <StaffPhotoUploader name={staff.name} photoUrl={staff.photoUrl} canEdit={!preview} labels={{ add: t("addPhoto"), change: t("changePhoto") }} />
          <div>
            <div className="text-lg font-bold">{staff.name}</div>
            <div className="text-sm text-muted-foreground">{staff.designation}</div>
          </div>
        </div>
        <dl className="mt-4 divide-y divide-border text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">{t("correctDetails")}</p>
      </Section>

      {preview ? (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t("previewHidden")}</p>
      ) : (
        <>
      <Section title={t("notifications")}>
        <PushControl />
      </Section>

      <Section
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="size-4" /> {t("myPin")}
          </span>
        }
      >
        <p className="mb-3 text-sm text-muted-foreground">
          {t("pinHelp")} ({staff.mobile})
        </p>
        <ChangePasswordDialog selfService />
        <p className="mt-3 text-xs text-muted-foreground">
          <Link href="/staff-reset" className="text-primary">
            {t("forgotPin")}
          </Link>
        </p>
      </Section>

      <StaffLogoutButton />
        </>
      )}
    </div>
  );
}
