import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, KeyRound, Landmark, MapPin, Megaphone, Navigation, Phone, Users, BadgeIndianRupee, HandCoins } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getPortalHome } from "@/server/staff-portal";
import { getStaffMoney } from "@/server/staff-balance";
import { getStaffLang } from "@/server/staff-lang";
import { getCompanySettings } from "@/server/settings";
import { COMPANY, SERVICE_LABELS } from "@/lib/constants";
import { inrFor, staffLocale, staffT, type StaffKey } from "@/lib/staff-i18n";
import { initials, cn } from "@/lib/utils";
import { NotifNudge } from "@/components/staff-app/notif-nudge";

export const dynamic = "force-dynamic";

// Staff App home — deliberately simple. Order (owner, final staff-app prompt):
// Today's Work → Attendance → Salary summary → My Money (loan) → Announcements. Big numbers, few colours:
// green = earned / owed to the worker, red = paid / advance, loan in its own box.

const STATUS_CLS: Record<string, string> = {
  PRESENT: "bg-success text-white",
  HALF_DAY: "bg-warning text-white",
  ABSENT: "bg-destructive text-white",
  LEAVE: "bg-violet-600 text-white",
  WEEKLY_OFF: "bg-slate-400 text-white",
};

export default async function StaffHomePage() {
  const { staff, onInitialPin, notifUserId, preview } = await requireMyStaff();
  if (!staff) return null;
  const [home, money, lang, settings] = await Promise.all([getPortalHome(staff, notifUserId), getStaffMoney(staff.id), getStaffLang(), getCompanySettings()]);
  const t = staffT(lang);
  const inr = (n: number) => inrFor(lang, n);
  const today = new Date();
  const officePhone = [settings.phone, ...COMPANY.phones].filter(Boolean)[0];
  const due = money?.salaryDue ?? 0;
  // Loan Given shown to the worker = opening loan + loans given, so Given − Paid = Remaining.
  const loan = money ? { given: money.loan.opening + money.loan.given, paid: money.loan.paid, remaining: money.loan.remaining } : { given: 0, paid: 0, remaining: 0 };
  const status = home.attendance?.status ?? null;

  return (
    <div className="space-y-4">
      {/* 👤 Name + employee code (compact) */}
      <section className="flex items-center gap-3">
        {staff.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staff.photoUrl} alt="" className="size-12 rounded-full border border-border object-cover" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">{initials(staff.name)}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="break-words text-lg font-extrabold leading-tight">{staff.name}</div>
          <div className="text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{staff.employeeCode}</span> · {staff.designation}
          </div>
        </div>
      </section>

      {/* 📅 Today's Work */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold">📅 {t("todaysWork")}</h2>
          <span className={cn("rounded-full px-3 py-1 text-xs font-bold", status ? STATUS_CLS[status] : "bg-muted text-muted-foreground")}>
            {t("todayAttendance")}: {status ? t(status as StaffKey) : t("notMarked")}
          </span>
        </div>
        <p className="-mt-2 mb-3 text-xs text-muted-foreground">{today.toLocaleDateString(staffLocale(lang), { weekday: "long", day: "numeric", month: "long" })}</p>
        {home.todaysJobs.length === 0 ? (
          <p className="rounded-2xl bg-muted/60 p-4 text-center text-sm font-medium text-muted-foreground">{t("noWorkToday")}</p>
        ) : (
          <ul className="space-y-3">
            {home.todaysJobs.map((j) => (
              <li key={j.id} className="space-y-2 rounded-2xl border border-primary/25 bg-primary/[0.03] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-base font-bold">{SERVICE_LABELS[j.service] ?? j.service}</div>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{t(j.status as StaffKey)}</span>
                </div>
                {(j.packageName || j.serviceVariant) && <div className="text-sm font-medium">{j.packageName || j.serviceVariant}</div>}
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-muted-foreground" /> {j.scheduledTime}
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{j.area}</span>
                </div>
                {j.team.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="flex flex-wrap gap-1.5">
                      {j.team.map((m) => (
                        <span key={m.staffId} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", m.isMe ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          {m.isMe ? t("you") : m.name}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={directionsHref(j.address, j.mapLink)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-semibold"
                  >
                    <Navigation className="size-4" /> {t("directions")}
                  </a>
                  <Link href={`/my/jobs/${j.id}`} className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                    {t("jobDetails")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {officePhone && (
          <a href={`tel:${officePhone}`} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-muted text-sm font-semibold text-foreground">
            <Phone className="size-4" /> {t("callOffice")}
          </a>
        )}
      </section>

      {!preview && <NotifNudge label={t("turnOnAlerts")} />}

      {onInitialPin && (
        <Link href="/my/account" className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <KeyRound className="size-5 shrink-0 text-warning" />
          <span className="flex-1 font-medium">{t("makePinPrivate")}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      {/* 📆 Attendance this month */}
      <Link href="/my/calendar" className="block rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <CalendarDays className="size-5 text-primary" /> 📆 {t("attendance")} · {t("thisMonth")}
          </h2>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <AttStat label={t("PRESENT")} value={money?.month.present ?? 0} cls="text-success" />
          <AttStat label={t("HALF_DAY")} value={money?.month.halfDay ?? 0} cls="text-warning" />
          <AttStat label={t("ABSENT")} value={money?.month.absent ?? 0} cls="text-destructive" />
          <AttStat label={t("LEAVE")} value={money?.month.leave ?? 0} cls="text-violet-600" />
        </div>
      </Link>

      {/* 💰 Salary summary: Salary · Paid · Due */}
      <section className="space-y-2">
        <h2 className="px-1 text-base font-bold">💰 {t("salarySummary")}</h2>
        <div className="grid grid-cols-2 gap-2">
          <MoneyCard
            icon={<BadgeIndianRupee className="size-5" />}
            emoji="💰"
            label={t("mySalary")}
            sub={money?.month.fare ? `${t("thisMonth")} · + ${t("autoFare")} ${inr(money.month.fare)}` : t("thisMonth")}
            value={inr(money?.month.salary ?? 0)}
            tone="green"
          />
          <MoneyCard icon={<HandCoins className="size-5" />} emoji="💵" label={t("paid")} sub={t("thisMonth")} value={inr(money?.month.paid ?? 0)} tone="red" />
        </div>
        <Link
          href="/my/records"
          className={cn(
            "flex items-center justify-between rounded-3xl p-4 shadow-sm",
            due > 0 ? "bg-success text-white" : due < 0 ? "bg-destructive text-white" : "bg-card border border-border",
          )}
        >
          <div>
            <div className="text-sm font-semibold opacity-90">{due > 0 ? `🟢 ${t("salaryDue")}` : due < 0 ? `🔴 ${t("advanceTaken")}` : `✅ ${t("allSettled")}`}</div>
            <div className="text-4xl font-extrabold tabular-nums">{inr(due)}</div>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold opacity-90">
            {t("seeDetails")} <ChevronRight className="size-4" />
          </span>
        </Link>
      </section>

      {/* 🏦 My Loan — separate from salary */}
      <section className="rounded-3xl border-2 border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-indigo-900 dark:text-indigo-200">
          <Landmark className="size-5" /> 🏦 {t("myLoan")}
        </h2>
        {loan.given === 0 && loan.remaining === 0 ? (
          <p className="text-sm font-medium text-indigo-900/70 dark:text-indigo-200/70">{t("noLoan")}</p>
        ) : (
          <>
            <div className="grid grid-cols-3 items-center gap-1 text-center">
              <LoanStep label={t("loanGiven")} value={inr(loan.given)} />
              <LoanStep label={t("loanPaid")} value={inr(loan.paid)} />
              <LoanStep label={t("loanRemaining")} value={inr(loan.remaining)} strong />
            </div>
            <p className="mt-2 text-center text-[11px] text-indigo-900/70 dark:text-indigo-200/70">{t("loanNote")}</p>
          </>
        )}
      </section>

      {/* 📢 Announcements (office messages only) */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <Link href="/my/announcements" className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Megaphone className="size-5 text-primary" /> {t("announcements")}
          </h2>
          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            {t("seeAll")} <ChevronRight className="size-4" />
          </span>
        </Link>
        {home.announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noAnnouncements")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {home.announcements.map((a) => (
              <li key={a.id}>
                <Link href={`/my/announcements#a-${a.id}`} className="flex items-start gap-2 py-2">
                  {!a.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={t("unreadNew")} />}
                  <span className={cn("min-w-0 flex-1 text-sm", !a.read && "font-semibold")}>
                    {a.important && <span className="mr-1 text-destructive">●</span>}
                    {a.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{a.publishedAt.toLocaleDateString(staffLocale(lang), { day: "numeric", month: "short" })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Google Maps directions from the phone's current location to the site. */
function directionsHref(address: string, mapLink: string | null) {
  const coords = mapLink?.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coords ? `${coords[1]},${coords[2]}` : address)}&travelmode=driving`;
}

function MoneyCard({ icon, emoji, label, sub, value, tone }: { icon: React.ReactNode; emoji: string; label: string; sub: string; value: string; tone: "green" | "red" }) {
  return (
    <div className={cn("rounded-3xl border p-3.5 shadow-sm", tone === "green" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
      <div className={cn("flex items-center gap-1.5 text-sm font-bold", tone === "green" ? "text-success" : "text-destructive")}>
        {icon} {emoji} {label}
      </div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
      <div className={cn("mt-1 text-2xl font-extrabold tabular-nums", tone === "green" ? "text-success" : "text-destructive")}>{value}</div>
    </div>
  );
}

function LoanStep({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-2", strong ? "bg-indigo-600 text-white" : "bg-white/70 text-indigo-950 dark:bg-indigo-900/40 dark:text-indigo-100")}>
      <div className="text-[11px] font-semibold leading-tight">{label}</div>
      <div className={cn("font-extrabold tabular-nums", strong ? "text-xl" : "text-base")}>{value}</div>
    </div>
  );
}

function AttStat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-2">
      <div className={cn("text-2xl font-extrabold tabular-nums", cls)}>{value}</div>
      <div className="text-[11px] font-medium leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}
