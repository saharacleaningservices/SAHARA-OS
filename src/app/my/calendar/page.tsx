import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getMyMonth, getMyYear } from "@/server/staff-portal";
import { Section, Stat, STATUS_STYLE } from "@/components/staff-app/ui";
import { cn } from "@/lib/utils";
import { getStaffLang } from "@/server/staff-lang";
import { staffLocale, staffT, type Lang, type StaffKey } from "@/lib/staff-i18n";

const SHORT: Record<Lang, Record<string, string>> = {
  en: { PRESENT: "P", HALF_DAY: "H", ABSENT: "A", LEAVE: "L", WEEKLY_OFF: "WO" },
  hi: { PRESENT: "हा", HALF_DAY: "आ", ABSENT: "गै", LEAVE: "छु", WEEKLY_OFF: "सा" },
  mr: { PRESENT: "ह", HALF_DAY: "अ", ABSENT: "गै", LEAVE: "र", WEEKLY_OFF: "सु" },
};

export const dynamic = "force-dynamic";

function Legend({ t }: { t: (k: StaffKey) => string }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
      {Object.entries(STATUS_STYLE).map(([k, s]) => (
        <span key={k} className="flex items-center gap-1">
          <span className={cn("size-2.5 rounded-full", s.dot)} /> {t(k as StaffKey)}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-full border-2 border-primary" /> {t("jobAssigned")}
      </span>
      <span className="flex items-center gap-1">
        <span className="font-bold text-primary">₹</span> {t("moneyMark")}
      </span>
    </div>
  );
}

export default async function StaffCalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; year?: string; month?: string }> }) {
  const { staff } = await requireMyStaff();
  if (!staff) return null;
  const lang = await getStaffLang();
  const t = staffT(lang);
  const loc = staffLocale(lang);
  const monthShort = (m: number) => new Date(2026, m - 1, 1).toLocaleDateString(loc, { month: "short" });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 1, 1 + i).toLocaleDateString(loc, { weekday: "narrow" })); // 1 Feb 2026 is a Sunday
  const sp = await searchParams;
  const now = new Date();
  const view = sp.view === "year" ? "year" : "month";
  const year = Math.min(Math.max(Number(sp.year) || now.getFullYear(), 2020), 2100);
  const month = Math.min(Math.max(Number(sp.month) || now.getMonth() + 1, 1), 12);

  const tabs = (
    <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
      {(["month", "year"] as const).map((v) => (
        <Link
          key={v}
          href={`/my/calendar?view=${v}&year=${year}&month=${month}`}
          className={cn("flex min-h-10 items-center justify-center rounded-lg", view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
        >
          {v === "month" ? t("month") : t("year")}
        </Link>
      ))}
    </div>
  );

  if (view === "year") {
    const { months } = await getMyYear(staff.id, year);
    const totals = months.reduce(
      (t, m) => ({ present: t.present + m.present, half: t.half + m.halfDay, absent: t.absent + m.absent, leave: t.leave + m.leave, off: t.off + m.weeklyOff, jobs: t.jobs + m.jobs }),
      { present: 0, half: 0, absent: 0, leave: 0, off: 0, jobs: 0 },
    );
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold">📆 {t("myCalendar")}</h1>
        {tabs}
        <div className="flex items-center justify-between">
          <Link href={`/my/calendar?view=year&year=${year - 1}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Previous year">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="text-lg font-semibold">{year}</div>
          <Link href={`/my/calendar?view=year&year=${year + 1}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Next year">
            <ChevronRight className="size-5" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t("PRESENT")} value={totals.present} tone="good" />
          <Stat label={t("HALF_DAY")} value={totals.half} tone="warn" />
          <Stat label={t("ABSENT")} value={totals.absent} tone="bad" />
          <Stat label={t("LEAVE")} value={totals.leave} />
          <Stat label={t("WEEKLY_OFF")} value={totals.off} />
          <Stat label={t("jobs")} value={totals.jobs} tone="primary" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {months.map((m) => (
            <Link key={m.month} href={`/my/calendar?view=month&year=${year}&month=${m.month}`} className="rounded-2xl border border-border bg-card p-2.5 shadow-sm">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-semibold">{monthShort(m.month)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {SHORT[lang].PRESENT} {m.present + m.halfDay * 0.5} · {SHORT[lang].ABSENT} {m.absent}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-[3px]">
                {Array.from({ length: m.firstWeekday }).map((_, i) => (
                  <span key={`b${i}`} />
                ))}
                {m.days.map((d) => (
                  <span
                    key={d.iso}
                    className={cn(
                      "aspect-square rounded-[3px]",
                      d.status ? STATUS_STYLE[d.status]?.dot : "bg-muted",
                      d.hasJob && !d.status && "ring-1 ring-inset ring-primary",
                    )}
                    title={d.iso}
                  />
                ))}
              </div>
            </Link>
          ))}
        </div>
        <Legend t={t} />
      </div>
    );
  }

  const { days, totals } = await getMyMonth(staff.id, year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">📆 {t("myCalendar")}</h1>
      {tabs}
      <Section>
        <div className="mb-3 flex items-center justify-between">
          <Link href={`/my/calendar?year=${prev.y}&month=${prev.m}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Previous month">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="text-base font-semibold">{new Date(year, month - 1, 1).toLocaleDateString(loc, { month: "long", year: "numeric" })}</div>
          <Link href={`/my/calendar?year=${next.y}&month=${next.m}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Next month">
            <ChevronRight className="size-5" />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
          {weekdays.map((w, i) => (
            <div key={i} className="py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {days.map((d) => {
            const s = d.status ? STATUS_STYLE[d.status] : null;
            const money = d.hasAdvance || d.hasFine || d.hasReward;
            return (
              <Link
                key={d.iso}
                href={`/my/day/${d.iso}`}
                aria-label={`${d.iso}${d.status ? `, ${t(d.status as StaffKey)}` : ""}${d.jobCount ? `, ${d.jobCount} ${t("jobs")}` : ""}`}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm font-semibold transition-transform active:scale-95",
                  s ? s.cls : "bg-muted/60 text-foreground",
                  d.jobCount > 0 && !s && "ring-2 ring-inset ring-primary",
                  d.jobCount > 0 && s && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                  d.isToday && "outline outline-2 outline-offset-2 outline-foreground",
                )}
              >
                {d.day}
                {s && d.status && <span className="text-[9px] font-bold leading-none opacity-90">{SHORT[lang][d.status]}</span>}
                {money && <span className={cn("absolute right-0.5 top-0 text-[10px] font-bold", s ? "text-white" : "text-primary")}>₹</span>}
              </Link>
            );
          })}
        </div>
        <div className="mt-3">
          <Legend t={t} />
        </div>
      </Section>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("PRESENT")} value={totals.present} tone="good" />
        <Stat label={t("HALF_DAY")} value={totals.halfDay} tone="warn" />
        <Stat label={t("ABSENT")} value={totals.absent} tone="bad" />
        <Stat label={t("LEAVE")} value={totals.leave} />
        <Stat label={t("WEEKLY_OFF")} value={totals.weeklyOff} />
        <Stat label={t("jobs")} value={totals.jobs} tone="primary" />
      </div>
      <p className="text-center text-xs text-muted-foreground">{t("tapDate")}</p>
    </div>
  );
}
