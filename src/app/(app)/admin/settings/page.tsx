import Link from "next/link";
import { BellRing, MessageCircle, ScrollText, Settings } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/current-user";
import { canAccess } from "@/lib/constants";
import { SETTINGS_PAGES } from "@/components/layout/nav-config";
import { listPendingDevices } from "@/server/devices";
import { getOpenSecurityOtps } from "@/server/security";

export const dynamic = "force-dynamic";

/**
 * Settings & Admin → Settings & Controls (owner 2026-11-06, Task 6): one hub for the admin pages that left the
 * sidebar. Tabs: Controls · System Logs (Audit Log, Device Approvals, Security Approvals). Each tile only shows when
 * the role can open that page (canAccess — unchanged rules). Security alerts arrive in the bell, not on WhatsApp.
 */
export default async function SettingsControlsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireUser();
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "system-logs" ? "system-logs" : "controls";
  const pages = SETTINGS_PAGES.filter((p) => canAccess(session.role, p.section));
  const canLogs = pages.some((p) => p.tab === "system-logs");
  const shown = pages.filter((p) => p.tab === (canLogs ? tab : "controls"));
  const [devices, otps] = canLogs
    ? await Promise.all([listPendingDevices().catch(() => []), getOpenSecurityOtps().catch(() => [])])
    : [[], []];
  const pending: Record<string, number> = { "/admin/device-approvals": devices.length, "/admin/security-approvals": otps.length };

  const tabCls = (on: boolean) => `flex-1 px-3 py-2 text-center sm:flex-none ${on ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`;
  return (
    <div className="space-y-4">
      <PageHeader title="Settings & Controls" description="Company settings, users, pricing, reminders and system logs in one place." />

      {canLogs && (
        <div role="tablist" className="inline-flex w-full overflow-hidden rounded-xl border bg-card text-sm font-semibold sm:w-auto">
          <Link role="tab" aria-selected={tab === "controls"} href="/admin/settings" className={tabCls(tab === "controls")}>
            <Settings className="mr-1 inline size-4" /> Controls
          </Link>
          <Link role="tab" aria-selected={tab === "system-logs"} href="/admin/settings?tab=system-logs" className={tabCls(tab === "system-logs")}>
            <ScrollText className="mr-1 inline size-4" /> System Logs
            {devices.length + otps.length > 0 && <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-xs text-white">{devices.length + otps.length}</span>}
          </Link>
        </div>
      )}

      {tab === "system-logs" && canLogs && (
        <p className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          <BellRing className="size-3.5" /> Security alerts (new device, login attempts, password / login-ID OTPs) now arrive in the notification bell only — no WhatsApp copy. Everything stays in the Audit Log.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Nothing to configure for your role.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <Link key={p.href} href={p.href} className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm transition hover:border-primary/40">
              <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><p.icon className="size-4" /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold">
                  {p.label}
                  {(pending[p.href] ?? 0) > 0 && <span className="rounded-full bg-destructive px-1.5 text-xs text-white">{pending[p.href]}</span>}
                </span>
                <span className="block text-xs text-muted-foreground">{p.hint}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {canAccess(session.role, "whatsapp-log") && (
        <Link href="/admin/whatsapp-inbox" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <MessageCircle className="size-4" /> Open Sahara WhatsApp Inbox
        </Link>
      )}
    </div>
  );
}
