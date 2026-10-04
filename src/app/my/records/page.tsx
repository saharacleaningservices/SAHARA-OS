import Link from "next/link";
import { ChevronLeft, ChevronRight, FileDown, Eye } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getMyYearSummary, getMyLedgerLists, getMyJobHistory, teamHistoryFrom, toIsoDay } from "@/server/staff-portal";
import { SERVICE_LABELS } from "@/lib/constants";
import { formatINR, cn } from "@/lib/utils";
import { Section, Stat, StatusChip, EmptyNote, MONTHS, JOB_STATUS_LABEL } from "@/components/staff-app/ui";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "summary", label: "Summary" },
  { key: "salary", label: "Salary" },
  { key: "attendance", label: "Attendance" },
  { key: "jobs", label: "Jobs / Sites" },
  { key: "team", label: "Team" },
  { key: "advance", label: "Advance" },
  { key: "fines", label: "Debit / Fine" },
  { key: "rewards", label: "Rewards" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function StaffRecordsPage({ searchParams }: { searchParams: Promise<{ tab?: string; year?: string }> }) {
  const { staff, preview } = await requireMyStaff();
  // Owner preview uses the office payslip route (the staff route only serves the signed-in staff member).
  const slipHref = (m: number, dl = false) =>
    preview ? `/api/staff/${staff?.id}/payslip/pdf?year=${year}&month=${m}${dl ? "&download=1" : ""}` : `/api/my/payslip?year=${year}&month=${m}${dl ? "&download=1" : ""}`;
  if (!staff) return null;
  const sp = await searchParams;
  const now = new Date();
  const year = Math.min(Math.max(Number(sp.year) || now.getFullYear(), 2020), 2100);
  const tab: Tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "summary") as Tab;
  const href = (t: Tab, y = year) => `/my/records?tab=${t}&year=${y}`;

  const needsSummary = tab === "summary" || tab === "salary";
  const needsLists = ["attendance", "advance", "fines", "rewards", "salary"].includes(tab);
  const needsJobs = tab === "jobs" || tab === "team";
  const [summary, lists, jobs] = await Promise.all([
    needsSummary ? getMyYearSummary(staff, year) : null,
    needsLists ? getMyLedgerLists(staff.id, year) : null,
    needsJobs ? getMyJobHistory(staff.id, year) : null,
  ]);
  // Months with any activity, plus the current month — not empty months before joining.
  const isCurrent = (m: number) => year === now.getFullYear() && m === now.getMonth() + 1;
  const visibleMonths =
    summary?.months.filter(
      (m) =>
        isCurrent(m.month) ||
        m.present + m.halfDay + m.absent + m.leave + m.weeklyOff > 0 ||
        m.earned || m.rewards || m.advances || m.fines,
    ) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My Records</h1>
        <div className="flex items-center gap-1">
          <Link href={href(tab, year - 1)} className="flex size-10 items-center justify-center rounded-full border border-border" aria-label="Previous year">
            <ChevronLeft className="size-4" />
          </Link>
          <span className="w-12 text-center text-sm font-semibold">{year}</span>
          <Link href={href(tab, year + 1)} className="flex size-10 items-center justify-center rounded-full border border-border" aria-label="Next year">
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <div className="flex w-max gap-1.5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              className={cn(
                "flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium",
                tab === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      {tab === "summary" && summary && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Payable days" value={summary.total.payableDays} tone="primary" />
            <Stat label="Earned" value={formatINR(summary.total.earned)} />
            <Stat label="Rewards" value={formatINR(summary.total.rewards)} tone="good" />
            <Stat label="Advances" value={formatINR(summary.total.advances)} tone="warn" />
            <Stat label="Debit / fine" value={formatINR(summary.total.fines)} tone="bad" />
            <Stat label="Net payable" value={formatINR(summary.total.netPayable)} tone="primary" />
            <Stat label="Salary paid" value={formatINR(summary.total.paid)} />
            <Stat label="Balance" value={formatINR(summary.total.balance)} tone={summary.total.balance > 0 ? "warn" : undefined} />
          </div>
          <Section title={`Month by month — ${year}`}>
            {visibleMonths.length === 0 ? (
              <EmptyNote>No records for {year}.</EmptyNote>
            ) : (
              <div className="-mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-muted-foreground">
                      <th className="px-1 py-1.5">Month</th>
                      <th className="px-1 py-1.5 text-right">P</th>
                      <th className="px-1 py-1.5 text-right">A</th>
                      <th className="px-1 py-1.5 text-right">Earned</th>
                      <th className="px-1 py-1.5 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleMonths.map((m) => (
                      <tr key={m.month}>
                        <td className="px-1 py-2 font-medium">
                          <Link href={`/my/calendar?year=${year}&month=${m.month}`} className="text-primary">
                            {MONTHS[m.month - 1]}
                          </Link>
                        </td>
                        <td className="px-1 py-2 text-right tabular-nums">{m.present + m.halfDay * 0.5}</td>
                        <td className="px-1 py-2 text-right tabular-nums">{m.absent}</td>
                        <td className="px-1 py-2 text-right tabular-nums">{formatINR(m.earned)}</td>
                        <td className="px-1 py-2 text-right font-semibold tabular-nums">{formatINR(m.netPayable)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {tab === "salary" && summary && lists && (
        <>
          <Section title="Basic salary">
            <div className="text-2xl font-bold">
              {staff.salaryType === "DAILY" ? `${formatINR(staff.dailyWage ?? 0)} / day` : `${formatINR(staff.monthlySalary ?? 0)} / month`}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {staff.salaryType === "DAILY"
                ? "Paid per day present (half day = half wage)."
                : "Monthly salary ÷ 30 per payable day (half day = half)."}{" "}
              Rewards are added; advances and debit/fines are deducted in the month they are given.
            </p>
          </Section>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={`Net ${year}`} value={formatINR(summary.total.netPayable)} tone="primary" />
            <Stat label="Paid" value={formatINR(summary.total.paid)} />
            <Stat label="Balance" value={formatINR(summary.total.balance)} tone={summary.total.balance > 0 ? "warn" : undefined} />
          </div>
          <Section title="Monthly calculation & salary slips">
            {visibleMonths.length === 0 ? (
              <EmptyNote>No salary records for {year}.</EmptyNote>
            ) : (
              <ul className="space-y-2">
                {[...visibleMonths].reverse().map((m) => (
                  <li key={m.month} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{new Date(year, m.month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
                      <div className="text-sm font-bold tabular-nums">{formatINR(m.netPayable)}</div>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Payable days</dt>
                      <dd className="text-right tabular-nums">{m.payableDays}</dd>
                      <dt className="text-muted-foreground">Earned</dt>
                      <dd className="text-right tabular-nums">{formatINR(m.earned)}</dd>
                      <dt className="text-muted-foreground">+ Rewards</dt>
                      <dd className="text-right tabular-nums text-success">{formatINR(m.rewards)}</dd>
                      <dt className="text-muted-foreground">− Advances</dt>
                      <dd className="text-right tabular-nums text-warning">{formatINR(m.advances)}</dd>
                      <dt className="text-muted-foreground">− Debit / fine</dt>
                      <dd className="text-right tabular-nums text-destructive">{formatINR(m.fines)}</dd>
                      <dt className="font-medium">Net payable</dt>
                      <dd className="text-right font-semibold tabular-nums">{formatINR(m.netPayable)}</dd>
                    </dl>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <a href={slipHref(m.month)} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium">
                        <Eye className="size-4" /> View slip
                      </a>
                      <a href={slipHref(m.month, true)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground">
                        <FileDown className="size-4" /> Download
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Salary payment history">
            {lists.payments.length === 0 ? (
              <EmptyNote>No salary payments recorded for {year}.</EmptyNote>
            ) : (
              <ul className="divide-y divide-border">
                {lists.payments.map((p) => (
                  <li key={p.id} id={`pay-${p.id}`} className="flex scroll-mt-20 items-center justify-between gap-3 py-2.5 target:bg-accent">
                    <div>
                      <div className="text-sm font-medium">Paid {fmtDay(p.date)}</div>
                      {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                    </div>
                    <div className="font-semibold tabular-nums">{formatINR(p.amount)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {tab === "attendance" && lists && (
        <Section title={`Attendance history — ${year}`}>
          {lists.attendance.length === 0 ? (
            <EmptyNote>No attendance recorded for {year}.</EmptyNote>
          ) : (
            <ul className="divide-y divide-border">
              {lists.attendance.map((a) => (
                <li key={a.id}>
                  <Link href={`/my/day/${toIsoDay(a.date)}`} className="flex min-h-11 items-center justify-between gap-3 py-2">
                    <span className="text-sm">{a.date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
                    <StatusChip status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === "jobs" && jobs && (
        <Section title={`Job / site history — ${year} (${jobs.length})`}>
          {jobs.length === 0 ? (
            <EmptyNote>No jobs for {year}.</EmptyNote>
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link href={`/my/day/${toIsoDay(j.scheduledDate)}#job-${j.id}`} className="block py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{SERVICE_LABELS[j.service] ?? j.service}</span>
                      <span className="text-xs text-muted-foreground">{fmtDay(j.scheduledDate)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {j.jobNumber} · {j.area} · {JOB_STATUS_LABEL[j.status] ?? j.status}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">Team: {j.team.map((m) => (m.isMe ? "You" : m.name)).join(", ") || "—"}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === "team" && jobs && (
        <Section title={`Who I worked with — ${year}`}>
          {(() => {
            const mates = teamHistoryFrom(jobs);
            return mates.length === 0 ? (
              <EmptyNote>No team history for {year}.</EmptyNote>
            ) : (
              <ul className="divide-y divide-border">
                {mates.map((m) => (
                  <li key={m.name + m.last.toISOString()} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">Last together {fmtDay(m.last)}</div>
                    </div>
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">{m.jobs} jobs</span>
                  </li>
                ))}
              </ul>
            );
          })()}
          <p className="mt-2 text-xs text-muted-foreground">Taken from each job’s team exactly as recorded on that job.</p>
        </Section>
      )}

      {tab === "advance" && lists && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label={`Advances ${year}`} value={formatINR(lists.advances.reduce((s, a) => s + a.amount, 0))} tone="warn" />
            <Stat label="All-time advances" value={formatINR(lists.advanceLifetime)} />
          </div>
          <Section title="Advance history">
            {lists.advances.length === 0 ? (
              <EmptyNote>No advances in {year}.</EmptyNote>
            ) : (
              <ul className="divide-y divide-border">
                {lists.advances.map((a) => (
                  <li key={a.id}>
                    <Link href={`/my/day/${toIsoDay(a.givenAt)}#adv-${a.id}`} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <div className="text-sm font-medium">{fmtDay(a.givenAt)}</div>
                        {a.reason && <div className="text-xs text-muted-foreground">{a.reason}</div>}
                      </div>
                      <span className="font-semibold tabular-nums text-warning">{formatINR(a.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Advances are deducted from that month’s salary. See the Salary tab for the balance.</p>
          </Section>
        </>
      )}

      {tab === "fines" && lists && (
        <Section title={`Debit / fine — ${year}`}>
          {lists.fines.length === 0 ? (
            <EmptyNote>No debits or fines in {year}. 👍</EmptyNote>
          ) : (
            <ul className="divide-y divide-border">
              {lists.fines.map((f) => (
                <li key={f.id}>
                  <Link href={`/my/day/${toIsoDay(f.date)}#fine-${f.id}`} className="flex items-start justify-between gap-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium">{f.type}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDay(f.date)}
                        {f.notes ? ` · ${f.notes}` : ""}
                      </div>
                    </div>
                    <span className="font-semibold tabular-nums text-destructive">{formatINR(f.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === "rewards" && lists && (
        <>
          <Section title={`My rewards — ${year}`}>
            {lists.rewards.length === 0 ? (
              <EmptyNote>No individual rewards in {year} yet.</EmptyNote>
            ) : (
              <ul className="divide-y divide-border">
                {lists.rewards.map((r) => (
                  <li key={r.id}>
                    <Link href={`/my/day/${toIsoDay(r.date)}#reward-${r.id}`} className="flex items-start justify-between gap-3 py-2.5">
                      <div>
                        <div className="text-sm font-medium">{r.type}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDay(r.date)}
                          {r.notes ? ` · ${r.notes}` : ""}
                        </div>
                      </div>
                      <span className="font-semibold tabular-nums text-success">+{formatINR(r.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title={`Team incentives — ${year}`}>
            {lists.teamIncentives.length === 0 ? (
              <EmptyNote>No team incentives for your jobs in {year} yet.</EmptyNote>
            ) : (
              <ul className="divide-y divide-border">
                {lists.teamIncentives.map((t) => (
                  <li key={t.id}>
                    <Link href={`/my/day/${toIsoDay(t.date)}#ti-${t.id}`} className="flex items-start justify-between gap-3 py-2.5">
                      <div>
                        <div className="text-sm font-medium">Job {t.jobNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDay(t.date)} · {t.teamSize}-member team
                        </div>
                      </div>
                      <span className="font-semibold tabular-nums text-success">{formatINR(t.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Team incentive is one total amount for the whole team on that job — it is not split per person and not added to your salary.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}
