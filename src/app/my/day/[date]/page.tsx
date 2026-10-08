import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, MapPin, Users, Clock, Lock, ExternalLink, Award } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getMyDay, parseIsoDay, toIsoDay } from "@/server/staff-portal";
import { SERVICE_LABELS } from "@/lib/constants";
import { Section, StatusChip, EmptyNote } from "@/components/staff-app/ui";
import { BOOKING_TERMS } from "@/lib/pricing-master";
import { PackageScopeCard } from "@/components/shared/package-scope-card";
import { getStaffLang } from "@/server/staff-lang";
import { inrFor, staffLocale, staffT, type StaffKey } from "@/lib/staff-i18n";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";



export default async function StaffDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { staff } = await requireMyStaff();
  if (!staff) return null;
  const { date } = await params;
  const day = parseIsoDay(date);
  if (!day) notFound();

  const [data, lang, khata] = await Promise.all([
    getMyDay(staff.id, day),
    getStaffLang(),
    // Imported Khata Book entries for this day (work + paid), shown as recorded.
    db.staffLedgerEntry.findMany({
      where: { staffId: staff.id, deletedAt: null, date: { gte: day, lt: new Date(day.getTime() + 86_400_000) }, kind: { not: "OPENING_BALANCE" } },
      select: { id: true, kind: true, amount: true, signedAmount: true, description: true },
    }),
  ]);
  const t = staffT(lang);
  const loc = staffLocale(lang);
  const formatINR = (n: number) => inrFor(lang, n);
  const time = (d: Date | null) => (d ? d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" }) : null);
  const prev = new Date(day);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = day.getTime() === today.getTime();
  const nothing =
    !data.attendance && data.jobs.length === 0 && !data.advances.length && !data.fines.length && !data.rewards.length && !data.payments.length && !khata.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/my/day/${toIsoDay(prev)}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Previous day">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-bold">{day.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" })}</h1>
          <Link href={`/my/calendar?year=${day.getFullYear()}&month=${day.getMonth() + 1}`} className="text-xs text-primary">
            {isToday ? `${t("todayAttendance")} · ` : ""}{t("backToCalendar")}
          </Link>
        </div>
        <Link href={`/my/day/${toIsoDay(next)}`} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Next day">
          <ChevronRight className="size-5" />
        </Link>
      </div>

      <Section
        id="attendance"
        title={`📆 ${t("attendance")}`}
        action={
          <StatusChip
            status={data.attendance?.status ?? (khata.some((k) => k.kind === "EARNING") ? "PRESENT" : null)}
            label={data.attendance?.status ? t(data.attendance.status as StaffKey) : khata.some((k) => k.kind === "EARNING") ? t("PRESENT") : t("notMarked")}
          />
        }
      >
        {data.attendance?.checkInTime || data.attendance?.checkOutTime ? (
          <div className="flex gap-4 text-sm">
            {data.attendance.checkInTime && <span>{t("inTime")}: {time(data.attendance.checkInTime)}</span>}
            {data.attendance.checkOutTime && <span>{t("outTime")}: {time(data.attendance.checkOutTime)}</span>}
          </div>
        ) : (
          <EmptyNote>{data.attendance || khata.length ? t("markedByOffice") : day > today ? t("futureDate") : t("notMarkedDay")}</EmptyNote>
        )}
        {data.attendance?.wageForDay != null && data.attendance.wageForDay > 0 && (
          <div className="mt-1 text-sm text-muted-foreground">{t("dayWage")}: {formatINR(data.attendance.wageForDay)}</div>
        )}
      </Section>

      <Section title={`🧹 ${t("siteJob")}${data.jobs.length > 1 ? ` (${data.jobs.length})` : ""}`}>
        {data.jobs.length === 0 ? (
          <EmptyNote>{t("noJobDay")}</EmptyNote>
        ) : (
          <ul className="space-y-3">
            {data.jobs.map((j) => (
              <li key={j.id} id={`job-${j.id}`} className="scroll-mt-20 space-y-2 rounded-xl border border-border p-3 target:border-primary target:ring-2 target:ring-primary/30">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{SERVICE_LABELS[j.service] ?? j.service}</div>
                    <div className="text-xs text-muted-foreground">
                      {j.jobNumber}
                      {j.serviceVariant ? ` · ${j.serviceVariant}` : ""}
                      {j.packageName ? ` · ${j.packageName}` : ""}
                    </div>
                  </div>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{t(j.status as StaffKey)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-muted-foreground" /> {j.scheduledTime}
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    <b>{j.customerName}</b> — {j.address}
                    {" "}
                    <a
                      href={j.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="whitespace-nowrap font-medium text-primary"
                    >
                      {t("openMap")}
                    </a>
                  </span>
                </div>
                <div className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-sm">
                  <span className="text-muted-foreground">{t("package")}: </span>
                  <b>{j.packageName || j.serviceVariant || t("asPerOffice")}</b>
                  {j.packageName && j.serviceVariant ? <span className="text-muted-foreground"> · {j.serviceVariant}</span> : null}
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-border p-2 text-center text-sm">
                  <div>
                    <div className="text-[11px] text-muted-foreground">{t("jobAmount")}</div>
                    <div className="font-semibold">{formatINR(j.jobAmount)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">{t("paid")}</div>
                    <div className="font-semibold">{formatINR(j.payment.paid)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">{t("balance")}</div>
                    <div className={`font-semibold ${j.payment.balance > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatINR(j.payment.balance)}</div>
                  </div>
                </div>
                {(j.scopeOfWork || j.priceType) && (
                  <div className="rounded-lg border border-border p-2.5 text-sm">
                    <div className="text-xs font-semibold uppercase text-primary">{t("scope")}</div>
                    {j.priceType && (
                      <div className="text-xs text-muted-foreground">
                        {t("price")}: {j.priceType === "FESTIVAL" ? `${t("priceFestival")}${j.festivalName ? ` · ${j.festivalName}` : ""}` : t("priceRegular")}
                      </div>
                    )}
                    {j.scopeOfWork && <p className="mt-1 whitespace-pre-line">{j.scopeOfWork}</p>}
                  </div>
                )}
                <PackageScopeCard service={j.service} packageName={j.packageName} serviceVariant={j.serviceVariant} />
                {j.comboServices.length > 0 && (
                  <div className="text-sm">
                    <div className="text-xs font-semibold uppercase text-primary">{t("servicesIncluded")}</div>
                    <ul className="mt-1 list-disc pl-5">
                      {j.comboServices.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs font-semibold uppercase text-primary">{t("terms")}</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {BOOKING_TERMS.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </details>

                <div className="flex items-start gap-2 text-sm">
                  <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      {j.team.length === 0 && <span className="text-muted-foreground">{t("teamNotAssigned")}</span>}
                      {j.team.map((m) => (
                        <span key={m.staffId} className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {m.isMe ? t("you") : m.name}
                          {m.isLead ? " ★" : ""}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {j.teamNumber ? `Team ${j.teamNumber}` : ""}
                      {j.supervisorName ? ` · ${t("supervisor")}: ${j.supervisorName}` : ""}
                      {j.teamFrozen && (
                        <span className="inline-flex items-center gap-0.5">
                          <Lock className="size-3" /> {t("teamAsOnDay")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {j.teamIncentive && (
                  <div id={`ti-${j.teamIncentive.id}`} className="flex scroll-mt-20 items-center gap-2 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs text-success">
                    <Award className="size-3.5" />
                    <span>
                      <b>Team incentive {formatINR(j.teamIncentive.amount)}</b> recorded for this team (team total, not individual pay)
                    </span>
                  </div>
                )}
                {j.feedback.map((f, i) => (
                  <div key={i} className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs">
                    <span className="font-semibold">{t("feedback")}:</span> {"★".repeat(Math.max(0, Math.min(5, f.rating)))}
                    {f.comment ? ` — “${f.comment}”` : ""}
                  </div>
                ))}
                {isToday && (
                  <Link href={`/my/jobs/${j.id}`} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground">
                    <ExternalLink className="size-4" /> Open job
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {(data.advances.length > 0 || data.fines.length > 0 || data.rewards.length > 0 || data.payments.length > 0 || khata.length > 0) && (
        <Section title={`💰 ${t("moneyThisDay")}`}>
          <ul className="divide-y divide-border">
            {khata.map((k) => (
              <li key={k.id} className="flex items-start justify-between gap-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">{k.signedAmount >= 0 ? t("work") : t("paid")}</div>
                  {k.description && <div className="text-xs text-muted-foreground">{k.description}</div>}
                  <div className="text-[10px] text-muted-foreground">{t("fromKhata")}</div>
                </div>
                <div className={`font-semibold tabular-nums ${k.signedAmount >= 0 ? "text-success" : "text-destructive"}`}>
                  {k.signedAmount >= 0 ? "+" : "−"}
                  {formatINR(k.amount)}
                </div>
              </li>
            ))}
            {data.advances.map((a) => (
              <li key={a.id} id={`adv-${a.id}`} className="flex scroll-mt-20 items-start justify-between gap-3 py-2.5 target:bg-accent">
                <div>
                  <div className="text-sm font-medium">{t("advance")}</div>
                  {a.reason && <div className="text-xs text-muted-foreground">{a.reason}</div>}
                </div>
                <div className="font-semibold tabular-nums text-destructive">−{formatINR(a.amount)}</div>
              </li>
            ))}
            {data.fines.map((f) => (
              <li key={f.id} id={`fine-${f.id}`} className="flex scroll-mt-20 items-start justify-between gap-3 py-2.5 target:bg-accent">
                <div>
                  <div className="text-sm font-medium">{t("fine")} · {f.type}</div>
                  {f.notes && <div className="text-xs text-muted-foreground">{f.notes}</div>}
                </div>
                <div className="font-semibold tabular-nums text-destructive">−{formatINR(f.amount)}</div>
              </li>
            ))}
            {data.rewards.map((r) => (
              <li key={r.id} id={`reward-${r.id}`} className="flex scroll-mt-20 items-start justify-between gap-3 py-2.5 target:bg-accent">
                <div>
                  <div className="text-sm font-medium">{t("reward")} · {r.type}</div>
                  {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
                </div>
                <div className="font-semibold tabular-nums text-success">+{formatINR(r.amount)}</div>
              </li>
            ))}
            {data.payments.map((p) => (
              <li key={p.id} id={`pay-${p.id}`} className="flex scroll-mt-20 items-start justify-between gap-3 py-2.5 target:bg-accent">
                <div>
                  <div className="text-sm font-medium">{t("salaryPaidLbl")}</div>
                  {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                </div>
                <div className="font-semibold tabular-nums text-destructive">−{formatINR(p.amount)}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {nothing && <p className="text-center text-sm text-muted-foreground">{t("nothingDay")}</p>}
      <p className="text-center text-xs text-muted-foreground">{t("recordsByOffice")}</p>
    </div>
  );
}
