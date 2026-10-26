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
  STAFF_PAYMENT: IndianRupee,
  STAFF_LOAN: Wallet,
  STAFF_OVERTIME: Award,
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

// Separate alert groups (one notification per real event; see server/staff-notify.ts).
const CATS = {
  all: { label: "allAlerts", kinds: null },
  jobs: { label: "jobs", kinds: ["STAFF_JOB_ASSIGNED", "STAFF_JOB_CHANGED"] },
  attendance: { label: "attendance", kinds: ["STAFF_ATTENDANCE"] },
  money: { label: "myMoney", kinds: ["STAFF_PAYMENT", "STAFF_SALARY", "STAFF_ADVANCE", "STAFF_LOAN", "STAFF_FINE", "STAFF_REWARD", "STAFF_OVERTIME"] },
  announcements: { label: "announcements", kinds: ["ANNOUNCEMENT"] },
} as const;
type Cat = keyof typeof CATS;

export default async function StaffAlertsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { staff, preview, notifUserId } = await requireMyStaff();
  const t = staffT(await getStaffLang());
  if (!staff) return null;
  const sp = await searchParams;
  const cat: Cat = sp.cat && sp.cat in CATS ? (sp.cat as Cat) : "all";
  const kinds = CATS[cat].kinds as readonly string[] | null;
  const all = notifUserId ? await getMyNotifications(notifUserId, 60) : [];
  const items = kinds ? all.filter((n) => kinds.includes(n.kind)) : all.slice(0, 40);
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
  const unreadIn = (c: Cat) => all.filter((n) => !n.readAt && (CATS[c].kinds === null || (CATS[c].kinds as readonly string[]).includes(n.kind))).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🔔 {t("navAlerts")}</h1>
        <Link href="/my/announcements" className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium">
          <Megaphone className="size-4 text-primary" /> {t("announcements")}
        </Link>
      </div>
      {!preview && <PushControl />}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(Object.keys(CATS) as Cat[]).map((c) => {
          const n = unreadIn(c);
          return (
            <Link key={c} href={c === "all" ? "/my/alerts" : `/my/alerts?cat=${c}`} className={cn("flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold", cat === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
              {t(CATS[c].label)}
              {n > 0 && <span className={cn("rounded-full px-1.5 text-[10px]", cat === c ? "bg-white/25" : "bg-destructive text-white")}>{n}</span>}
            </Link>
          );
        })}
      </div>
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
