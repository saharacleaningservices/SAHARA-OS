import Link from "next/link";
import { Bell, CalendarCheck, Wallet, Ban, Award, Briefcase, RefreshCw, Megaphone, IndianRupee } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getStaffLang } from "@/server/staff-lang";
import { staffT } from "@/lib/staff-i18n";
import { getMyNotifications } from "@/server/staff-portal";
import { Section, EmptyNote } from "@/components/staff-app/ui";
import { MarkReadOnView } from "@/components/staff-app/mark-read";
import { PushControl } from "@/components/staff-app/push-control";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ICONS: Record<string, typeof Bell> = {
  STAFF_ATTENDANCE: CalendarCheck,
  STAFF_ADVANCE: Wallet,
  STAFF_FINE: Ban,
  STAFF_REWARD: Award,
  STAFF_SALARY: IndianRupee,
  STAFF_JOB_ASSIGNED: Briefcase,
  STAFF_JOB_CHANGED: RefreshCw,
  ANNOUNCEMENT: Megaphone,
};

function ago(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function StaffAlertsPage() {
  const { staff, preview, notifUserId } = await requireMyStaff();
  const t = staffT(await getStaffLang());
  if (!staff) return null;
  const items = notifUserId ? await getMyNotifications(notifUserId) : [];
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🔔 {t("navAlerts")}</h1>
        <Link href="/my/announcements" className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium">
          <Megaphone className="size-4 text-primary" /> Announcements
        </Link>
      </div>
      {!preview && <PushControl />}
      <Section>
        {items.length === 0 ? (
          <EmptyNote>{t("noAlerts")}</EmptyNote>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const Icon = ICONS[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <Link href={n.href ?? "/my"} className="flex gap-3 py-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        n.critical ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", !n.readAt ? "font-semibold" : "font-medium text-foreground/80")}>{n.title}</span>
                      {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                      <span className="block text-[11px] text-muted-foreground">{ago(n.createdAt)}</span>
                    </span>
                    {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      {!preview && <MarkReadOnView ids={unreadIds} />}
    </div>
  );
}
