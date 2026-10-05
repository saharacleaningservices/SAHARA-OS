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

const TABS = ["salary", "work", "paid", "loan"] as const;
type Tab = (typeof TABS)[number];

export default async function MyMoneyPage({ searchParams }: { searchParams: Promise<{ tab?: string; year?: string }> }) {
  const { staff, preview } = await requireMyStaff();
  if (!staff) return null;
  const sp = await searchParams;
  const now = new Date();
  const year = Math.min(Math.max(Number(sp.year) || now.getFullYear(), 2020), 2100);
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "salary";
  const [data, money, lang] = await Promise.all([getStaffMoneyYear(staff.id, year), getStaffMoney(staff.id), getStaffLang()]);
  if (!data || !money) return null;
  const t = staffT(lang);
  const inr = (n: number) => inrFor(lang, n);
  const href = (k: Tab, y = year) => `/my/records?tab=${k}&year=${y}`;
  const monthName = (m: number) => new Date(year, m - 1, 1).toLocaleDateString(staffLocale(lang), { month: "long" });
  const fmt = (d: Date) => d.toLocaleDateString(staffLocale(lang), { day: "numeric", month: "short" });
  const cut = money.cutover;
  const slipHref = (m: number) => (preview ? `/api/staff/${staff.id}/payslip/pdf?year=${year}&month=${m}` : `/api/my/payslip?year=${year}&month=${m}`);
  const slipOk = (m: number) => !cut || new Date(year, m - 1, 1) > cut;
  const due = money.salaryDue;
  const isThisYear = year === now.getFullYear();
  const tabLabel: Record<Tab, string> = { salary: t("salary"), work: t("workList"), paid: t("paidList"), loan: t("loan") };

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
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b border-border bg-muted/50 px-4 py-2 text-[11px] font-bold uppercase text-muted-foreground">
            <span>{t("month")}</span>
            <span className="text-right">{t("workDays")}</span>
            <span className="text-right">{t("salary")}</span>
            <span className="text-right">{t("paid")}</span>
          </div>
          {data.months.filter((m) => m.salary || m.paid || m.opening || (isThisYear && m.month === now.getMonth() + 1)).length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">{t("nothingYet")}</p>
          )}
          {data.months
            .filter((m) => m.salary || m.paid || m.opening || (isThisYear && m.month === now.getMonth() + 1))
            .reverse()
            .map((m) => (
              <div key={m.month} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-b border-border px-4 py-3 last:border-0">
                <span className="font-semibold">
                  {monthName(m.month)}
                  {slipOk(m.month) && (m.salary || m.paid) ? (
                    <a href={slipHref(m.month)} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
                      <FileDown className="size-3" /> {t("salarySlip")}
                    </a>
                  ) : null}
                  {m.opening ? <span className="block text-[11px] font-normal text-muted-foreground">{t("oldBalance")}: {signed(lang, m.opening)}</span> : null}
                </span>
                <span className="text-right tabular-nums">{m.workDays}</span>
                <span className="text-right font-bold tabular-nums text-success">{inr(m.salary)}</span>
                <span className="text-right font-bold tabular-nums text-destructive">{inr(m.paid)}</span>
              </div>
            ))}
        </section>
      )}

      {(tab === "work" || tab === "paid") && (
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          {(tab === "work" ? data.work : data.paid).length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("nothingYet")}</p>}
          <ul className="divide-y divide-border">
            {(tab === "work" ? data.work : data.paid).map((e, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-muted-foreground">{fmt(e.date)}</div>
                  <div className="break-words text-sm font-medium">{e.text || (tab === "work" ? t("work") : t("paid"))}</div>
                  {e.source === "KHATABOOK" && <div className="text-[10px] text-muted-foreground">{t("fromKhata")}</div>}
                </div>
                <div className={cn("shrink-0 text-base font-extrabold tabular-nums", tab === "work" ? "text-success" : "text-destructive")}>
                  {tab === "work" ? "+" : "−"}
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
