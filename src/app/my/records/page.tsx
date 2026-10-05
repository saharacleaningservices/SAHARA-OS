import Link from "next/link";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { requireMyStaff } from "@/server/staff-portal-session";
import { getStaffMoneyYear, getStaffMoney } from "@/server/staff-balance";
import { getStaffLang } from "@/server/staff-lang";
import { inrFor, staffLocale, staffT, type Lang } from "@/lib/staff-i18n";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// "My Money" — simple words only (Salary · Paid · Due · Loan · Work). Same
// numbers as the home screen and the office (server/staff-balance.ts).

const TABS = ["salary", "ledger", "paid", "loan"] as const;
type Tab = (typeof TABS)[number];

export default async function MyMoneyPage({ searchParams }: { searchParams: Promise<{ tab?: string; year?: string }> }) {
  const { staff, preview } = await requireMyStaff();
  if (!staff) return null;
  const sp = await searchParams;
  const now = new Date();
  const year = Math.min(Math.max(Number(sp.year) || now.getFullYear(), 2020), 2100);
  const tab: Tab = sp.tab === "work" ? "ledger" : (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "salary";
  const [data, money, lang] = await Promise.all([getStaffMoneyYear(staff.id, year), getStaffMoney(staff.id), getStaffLang()]);
  if (!data || !money) return null;
  const t = staffT(lang);
  const inr = (n: number) => inrFor(lang, n);
  const href = (k: Tab, y = year) => `/my/records?tab=${k}&year=${y}`;
  const fmt = (d: Date) => d.toLocaleDateString(staffLocale(lang), { day: "numeric", month: "short" });
  const cut = money.cutover;
  const slipHref = (m: number) => (preview ? `/api/staff/${staff.id}/payslip/pdf?year=${year}&month=${m}` : `/api/my/payslip?year=${year}&month=${m}`);
  const slipOk = (m: number) => !cut || new Date(year, m - 1, 1) > cut;
  const due = money.salaryDue;
  const isThisYear = year === now.getFullYear();
  const tabLabel: Record<Tab, string> = { salary: t("salary"), ledger: t("ledger"), paid: t("paidList"), loan: t("loan") };
  // Due at the end of each month = running balance (old balance + salary + fare − paid). The latest month's Due equals the big number above.
  let run = data.startBalance;
  const monthRows = data.months.map((m) => {
    run += m.salary + m.fare - m.paid + m.opening;
    return { ...m, due: Math.round(run * 100) / 100 };
  });
  const visibleMonths = monthRows.filter((m) => m.salary || m.paid || m.opening || m.fare || (isThisYear && m.month === now.getMonth() + 1));
  const monthShort = (m: number) => new Date(year, m - 1, 1).toLocaleDateString(staffLocale(lang), { month: "short" });
  const yearOpening = monthRows.reduce((s2, m) => s2 + m.opening, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">💰 {t("myMoney")}</h1>
        <div className="flex items-center gap-1">
          <Link href={href(tab, year - 1)} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Previous year">
            <ChevronLeft className="size-5" />
          </Link>
          <span className="w-12 text-center text-base font-bold">{year}</span>
          <Link href={href(tab, year + 1)} className="flex size-11 items-center justify-center rounded-full border border-border" aria-label="Next year">
            <ChevronRight className="size-5" />
          </Link>
        </div>
      </div>

      <div className={cn("rounded-3xl p-4 shadow-sm", due > 0 ? "bg-success text-white" : due < 0 ? "bg-destructive text-white" : "border border-border bg-card")}>
        <div className="text-sm font-semibold opacity-90">{due > 0 ? `🟢 ${t("salaryDue")}` : due < 0 ? `🔴 ${t("advanceTaken")}` : `✅ ${t("allSettled")}`}</div>
        <div className="text-4xl font-extrabold tabular-nums">{inr(due)}</div>
        {!isThisYear && (
          <div className="mt-1 text-xs opacity-90">
            {year}: {t("balanceStart")} {signed(lang, data.startBalance)} → {signed(lang, data.endBalance)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1">
        {TABS.map((k) => (
          <Link
            key={k}
            href={href(k)}
            className={cn("flex min-h-11 items-center justify-center rounded-xl text-sm font-bold", tab === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}
          >
            {tabLabel[k]}
          </Link>
        ))}
      </div>

      {tab === "salary" && (
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {/* Fixed-width table: columns never overlap or wrap on a 360px phone. */}
          <table className="w-full table-fixed text-[13px] tabular-nums">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[11%]" />
              <col className="w-[22%]" />
              <col className="w-[21%]" />
              <col className="w-[22%]" />
            </colgroup>
            <thead className="bg-muted/50 text-[11px] font-bold uppercase text-muted-foreground">
              <tr>
                <th className="py-2 pl-3 text-left font-bold">{t("month")}</th>
                <th className="py-2 text-right font-bold">{t("daysShort")}</th>
                <th className="py-2 text-right font-bold">{t("salary")}</th>
                <th className="py-2 text-right font-bold">{t("paid")}</th>
                <th className="py-2 pr-3 text-right font-bold">{t("due")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleMonths.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-sm text-muted-foreground">{t("nothingYet")}</td>
                </tr>
              )}
              {visibleMonths
                .slice()
                .reverse()
                .map((m) => (
                  <tr key={m.month} className="align-top">
                    <td className="py-2.5 pl-3 font-semibold">
                      <span className="block truncate">{monthShort(m.month)}</span>
                      {slipOk(m.month) && (m.salary || m.paid) ? (
                        <a href={slipHref(m.month)} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                          <FileDown className="size-3" /> {t("salarySlip")}
                        </a>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right">{m.workDays}</td>
                    <td className="whitespace-nowrap py-2.5 text-right font-bold text-success">
                      {inr(m.salary)}
                      {m.fare ? <span className="block text-[10px] font-medium text-muted-foreground">+{inr(m.fare)} {t("fareShort")}</span> : null}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-right font-bold text-destructive">{inr(m.paid)}</td>
                    <td className={cn("whitespace-nowrap py-2.5 pr-3 text-right font-extrabold", m.due < 0 && "text-destructive")}>{signed(lang, m.due)}</td>
                  </tr>
                ))}
              {data.startBalance + yearOpening !== 0 && (
                <tr className="bg-muted/30 text-xs text-muted-foreground">
                  <td colSpan={4} className="py-2 pl-3">{t("oldBalance")}</td>
                  <td className="whitespace-nowrap py-2 pr-3 text-right font-bold">{signed(lang, data.startBalance + yearOpening)}</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-muted/50 font-extrabold">
              <tr>
                <td className="py-2.5 pl-3">{t("totalDue")}</td>
                <td className="py-2.5 text-right">{visibleMonths.reduce((s2, m) => s2 + m.workDays, 0)}</td>
                <td className="whitespace-nowrap py-2.5 text-right text-success">{inr(visibleMonths.reduce((s2, m) => s2 + m.salary + m.fare, 0))}</td>
                <td className="whitespace-nowrap py-2.5 text-right text-destructive">{inr(visibleMonths.reduce((s2, m) => s2 + m.paid, 0))}</td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right">{signed(lang, data.endBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      {tab === "ledger" && (
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5rem] gap-x-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-bold uppercase text-muted-foreground">
            <span>{t("date")}</span>
            <span className="text-right">{t("credit")}</span>
            <span className="text-right">{t("debit")}</span>
            <span className="text-right">{t("runningBalance")}</span>
          </div>
          {data.lines.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("nothingYet")}</p>}
          <ul className="divide-y divide-border">
            {data.lines.map((l, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_5rem] items-start gap-x-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-muted-foreground">{fmt(l.date)}</div>
                  <div className="break-words text-[13px]">{l.kind === "OVERTIME" ? `${t("overtime")} · ${l.text}` : l.kind === "AUTO_FARE" ? `${t("autoFare")}${l.text && l.text !== "Auto fare" ? ` · ${l.text}` : ""}` : l.text || (l.credit ? t("work") : t("paid"))}</div>
                  {l.source === "KHATABOOK" && <div className="text-[10px] text-muted-foreground">{t("fromKhata")}</div>}
                </div>
                <span className="text-right font-bold tabular-nums text-success">{l.credit ? inr(l.credit) : ""}</span>
                <span className="text-right font-bold tabular-nums text-destructive">{l.debit ? inr(l.debit) : ""}</span>
                <span className={cn("text-right font-extrabold tabular-nums", l.balance < 0 && "text-destructive")}>{signed(lang, l.balance)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "paid" && (
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {data.paid.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("nothingYet")}</p>}
          <ul className="divide-y divide-border">
            {data.paid.map((e, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-muted-foreground">{fmt(e.date)}</div>
                  <div className="break-words text-sm font-medium">{e.text || t("paid")}</div>
                  {e.source === "KHATABOOK" && <div className="text-[10px] text-muted-foreground">{t("fromKhata")}</div>}
                </div>
                <div className="shrink-0 text-base font-extrabold tabular-nums text-destructive">
                  −
                  {inr(e.amount)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "loan" && (
        <section className="space-y-3 rounded-3xl border-2 border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
          <div className="grid grid-cols-3 gap-1 text-center">
            {[
              [t("loanGiven"), money.loan.given],
              [t("loanPaid"), money.loan.paid],
              [t("loanRemaining"), money.loan.remaining],
            ].map(([l, v], i) => (
              <div key={i} className={cn("rounded-2xl p-2", i === 2 ? "bg-indigo-600 text-white" : "bg-white/70 text-indigo-950 dark:bg-indigo-900/40 dark:text-indigo-100")}>
                <div className="text-[11px] font-semibold leading-tight">{l}</div>
                <div className="text-lg font-extrabold tabular-nums">{inr(v as number)}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-indigo-900/70 dark:text-indigo-200/70">{t("loanNote")}</p>
          {data.loan.entries.length === 0 ? (
            <p className="text-sm text-indigo-900/70">{t("noLoan")}</p>
          ) : (
            <ul className="divide-y divide-indigo-200 rounded-2xl bg-white/70 dark:divide-indigo-900 dark:bg-indigo-900/30">
              {data.loan.entries.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-indigo-900/70 dark:text-indigo-200/70">{fmt(l.date)}</div>
                    <div className="break-words text-sm">{l.text || (l.signedAmount > 0 ? t("loanGiven") : t("loanPaid"))}</div>
                  </div>
                  <div className={cn("shrink-0 font-extrabold tabular-nums", l.signedAmount > 0 ? "text-indigo-700 dark:text-indigo-300" : "text-success")}>
                    {l.signedAmount > 0 ? t("loanGiven") : t("loanPaid")} {inr(l.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function signed(lang: Lang, n: number) {
  return `${n < 0 ? "−" : ""}${inrFor(lang, n)}`;
}
