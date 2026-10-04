import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { countMyUnread } from "@/server/staff-portal";
import { getCompanySettings } from "@/server/settings";
import { CompanyLogo } from "@/components/shared/company-logo";
import { StaffBottomNav } from "@/components/staff-app/bottom-nav";
import { StaffPushListener } from "@/components/staff-app/push-control";
import { StaffLogoutButton } from "@/components/staff-app/logout-button";
import { HashHighlight } from "@/components/staff-app/hash-highlight";
import { Toaster } from "@/components/ui/sonner";
import { exitStaffPreview } from "@/server/actions/staff-preview";

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
  const [settings, unread] = await Promise.all([getCompanySettings(), notifUserId ? countMyUnread(notifUserId) : 0]);

  return (
    <div className="min-h-dvh bg-background">
      <header
        className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-3 px-4">
          <Link href="/my" className="flex items-center" aria-label="Sahara Staff home">
            <CompanyLogo logoUrl={settings.logoUrl} className="h-8 w-auto" />
          </Link>
          <Link
            href="/my/account"
            className="flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium text-foreground"
          >
            <UserRound className="size-4 text-primary" />
            <span className="max-w-[9rem] truncate">{(staff?.name ?? session.name).split(" ")[0]}</span>
          </Link>
        </div>
      </header>

      {preview && (
        <div className="sticky top-14 z-30 border-b border-warning/40 bg-warning/15">
          <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-2 text-xs">
            <span>
              <b>Owner preview</b> · viewing as {preview.name} · read-only
            </span>
            <form action={exitStaffPreview}>
              <button className="min-h-9 rounded-full border border-border bg-card px-3 font-medium">Exit preview</button>
            </form>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-md px-4 pb-28 pt-4">
        {staff ? (
          children
        ) : (
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 text-center">
            <h1 className="text-base font-semibold">Your login isn’t linked to a staff profile yet</h1>
            <p className="text-sm text-muted-foreground">
              Please ask the office to enable your Staff App login from your staff record. Your attendance, jobs and salary
              will appear here once it’s linked.
            </p>
            <StaffLogoutButton />
          </div>
        )}
      </main>

      {staff && <StaffBottomNav unread={unread} />}
      {!preview && <StaffPushListener />}
      <HashHighlight />
      <Toaster position="top-center" richColors />
    </div>
  );
}
