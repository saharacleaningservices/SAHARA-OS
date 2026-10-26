import type { Metadata, Viewport } from "next";
import { AppLock } from "@/components/auth/app-lock";
import type { ReactNode } from "react";
import Link from "next/link";
import { requireMyStaff } from "@/server/staff-portal-session";
import { countMyUnread } from "@/server/staff-portal";
import { getCompanySettings } from "@/server/settings";
import { CompanyLogo } from "@/components/shared/company-logo";
import { StaffBottomNav } from "@/components/staff-app/bottom-nav";
import { StaffPushListener } from "@/components/staff-app/push-control";
import { StaffLogoutButton } from "@/components/staff-app/logout-button";
import { HashHighlight } from "@/components/staff-app/hash-highlight";
import { LanguageSwitcher } from "@/components/staff-app/language-switcher";
import { Toaster } from "@/components/ui/sonner";
import { exitStaffPreview } from "@/server/actions/staff-preview";
import { getStaffLang } from "@/server/staff-lang";
import { staffT } from "@/lib/staff-i18n";

export const metadata: Metadata = {
  title: "Sahara Staff",
  manifest: "/staff.webmanifest",
  appleWebApp: { capable: true, title: "Sahara Staff", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0B5ED7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function StaffAppLayout({ children }: { children: ReactNode }) {
  const { session, staff, preview, notifUserId } = await requireMyStaff();
  const [settings, unread, lang] = await Promise.all([getCompanySettings(), notifUserId ? countMyUnread(notifUserId) : 0, getStaffLang()]);
  const t = staffT(lang);

  return (
    <div className="staff-app min-h-dvh bg-background" lang={lang === "en" ? "en" : lang}>
      {/* Devanagari font for हिंदी / मराठी (falls back to the phone's built-in Noto / Mangal). */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&display=swap" />
      <header
        className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-3 px-4">
          <Link href="/my" className="flex items-center" aria-label="Sahara Staff home">
            <CompanyLogo logoUrl={settings.logoUrl} className="h-8 w-auto" />
          </Link>
          <span className="sr-only">{staff?.name ?? session.name}</span>
          <LanguageSwitcher lang={lang} label={t("language")} />
        </div>
      </header>

      {preview && (
        <div className="sticky top-14 z-30 border-b border-warning/40 bg-warning/15">
          <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-2 text-xs">
            <span>
              <b>{t("ownerPreview")}</b> · {preview.name}
            </span>
            <form action={exitStaffPreview}>
              <button className="min-h-9 rounded-full border border-border bg-card px-3 font-medium">{t("exitPreview")}</button>
            </form>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-md px-4 pb-28 pt-4">
        {staff ? (
          children
        ) : (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-center">
            <p className="text-sm font-medium">{t("notLinked")}</p>
            <StaffLogoutButton />
          </div>
        )}
      </main>

      {staff && <StaffBottomNav unread={unread} labels={{ home: t("navHome"), jobs: t("navJobs"), money: t("navMoney"), alerts: t("navAlerts"), profile: t("navProfile") }} />}
      {!preview && <StaffPushListener />}
      {!preview && <AppLock />}
      <HashHighlight />
      <Toaster position="top-center" richColors />
    </div>
  );
}
