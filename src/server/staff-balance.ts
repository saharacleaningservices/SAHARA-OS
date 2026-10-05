import { db } from "@/lib/db";
import { computeEarned } from "@/server/attendance";

// ─────────────────────────────────────────────────────────────────────────
// Staff money — ONE calculation for the Staff App, the CRM staff profile and
// the Khata Book import reconciliation.
//
// Every money event becomes one unified entry:
//   work  (+)  imported Khata earnings, attendance wage after the cutover, rewards
//   paid  (−)  imported Khata payments/advances/fines, advances, fines,
//              salary paid, loan recovery cut from salary (after the cutover)
//   opening    imported opening balance (signed)
//
//   Salary Due     = Σ work − Σ paid + opening
//   Loan Remaining = Σ loan given − Σ loan repaid   (separate from salary)
//
// Positive Salary Due = Sahara owes the worker ("You will give" in Khata Book);
// negative = the worker took more than earned ("You will get" / advance).
// Soft-deleted rows never count. Imported history covers everything up to
// Staff.ledgerCutoverAt; native records count only after it.
// ─────────────────────────────────────────────────────────────────────────

export type MoneyEntry = {
  date: Date;
  group: "work" | "paid" | "opening";
  amount: number; // positive (opening: signed)
  text: string;
  source: "KHATABOOK" | "APP";
  kind: string;
};
export type LoanEntry = { date: Date; kind: string; amount: number; signedAmount: number; text: string; fromSalary: boolean };

const r2 = (n: number) => Math.round(n * 100) / 100;
const LEDGER_GROUP: Record<string, MoneyEntry["group"]> = {
  EARNING: "work",
  OTHER_CREDIT: "work",
  AUTO_FARE: "work",
  TRANSFER_TO_LOAN: "opening",
  PAYMENT: "paid",
  ADVANCE: "paid",
  FINE: "paid",
  DEDUCTION: "paid",
  OPENING_BALANCE: "opening",
};

async function loadAll(staffId: string) {
  const staff = await db.staff.findUnique({
    where: { id: staffId },
    select: { id: true, name: true, salaryType: true, monthlySalary: true, ledgerCutoverAt: true },
  });
  if (!staff) return null;
  const cut = staff.ledgerCutoverAt;
  const after = cut ? { gt: cut } : undefined;
  const [ledger, loans, attendance, advances, fines, rewards, salaryPaid] = await Promise.all([
    db.staffLedgerEntry.findMany({ where: { staffId, deletedAt: null }, select: { date: true, kind: true, amount: true, signedAmount: true, description: true } }),
    db.staffLoanEntry.findMany({ where: { staffId, deletedAt: null }, orderBy: { date: "asc" }, select: { date: true, kind: true, amount: true, signedAmount: true, fromSalary: true, source: true, description: true } }),
    db.attendance.findMany({ where: { staffId, ...(after ? { date: after } : {}) }, select: { date: true, status: true, wageForDay: true, notes: true } }),
    db.advance.findMany({ where: { staffId, ...(after ? { givenAt: after } : {}) }, select: { givenAt: true, amount: true, reason: true } }),
    db.fineRecord.findMany({ where: { staffId, ...(after ? { date: after } : {}) }, select: { date: true, amount: true, type: true, notes: true } }),
    db.rewardRecord.findMany({ where: { staffId, ...(after ? { date: after } : {}) }, select: { date: true, amount: true, type: true } }),
    db.expense.findMany({ where: { staffId, category: "SALARY", deletedAt: null, isDemo: false, ...(after ? { date: after } : {}) }, select: { date: true, amount: true, description: true } }),
  ]);

  const entries: MoneyEntry[] = [];
  for (const l of ledger) {
    const group = LEDGER_GROUP[l.kind] ?? (l.signedAmount >= 0 ? "work" : "paid");
    entries.push({ date: l.date, group, amount: group === "opening" ? l.signedAmount : l.amount, text: l.description ?? "", source: "KHATABOOK", kind: l.kind });
  }
  for (const a of attendance) {
    const earned = computeEarned(staff, [a]).earned;
    if (earned > 0) entries.push({ date: a.date, group: "work", amount: earned, text: a.notes ?? (a.status === "HALF_DAY" ? "Half day" : "Work day"), source: "APP", kind: a.status });
  }
  for (const r of rewards) entries.push({ date: r.date, group: "work", amount: r.amount, text: r.type, source: "APP", kind: "REWARD" });
  for (const a of advances) entries.push({ date: a.givenAt, group: "paid", amount: a.amount, text: a.reason ?? "Advance", source: "APP", kind: "ADVANCE" });
  for (const f of fines) entries.push({ date: f.date, group: "paid", amount: f.amount, text: [f.type, f.notes].filter(Boolean).join(" · "), source: "APP", kind: "FINE" });
  for (const p of salaryPaid) entries.push({ date: p.date, group: "paid", amount: p.amount, text: p.description ?? "Salary paid", source: "APP", kind: "SALARY_PAID" });
  for (const l of loans) {
    // Recoveries cut from salary after the cutover also reduce Salary Due (imported ones are already inside the imported salary history).
    if (l.fromSalary && l.source !== "KHATABOOK" && (!cut || l.date > cut) && l.signedAmount < 0)
      entries.push({ date: l.date, group: "paid", amount: l.amount, text: l.description ?? "Loan cut from salary", source: "APP", kind: "LOAN_CUT" });
  }
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  const loanEntries: LoanEntry[] = loans.map((l) => ({ date: l.date, kind: l.kind, amount: l.amount, signedAmount: l.signedAmount, text: l.description ?? "", fromSalary: l.fromSalary }));
  return { staff, entries, loanEntries, attendance };
}

const total = (entries: MoneyEntry[]) =>
  entries.reduce((s, e) => s + (e.group === "work" ? e.amount : e.group === "paid" ? -e.amount : e.amount), 0);

export type StaffMoney = NonNullable<Awaited<ReturnType<typeof getStaffMoney>>>;

/** Headline numbers for the Staff App home / CRM / reconciliation. */
export async function getStaffMoney(staffId: string, now = new Date()) {
  const all = await loadAll(staffId);
  if (!all) return null;
  const { staff, entries, loanEntries, attendance } = all;
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  const m1 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const inM = (d: Date) => d >= m0 && d < m1;
  const month = entries.filter((e) => inM(e.date));
  const monthAtt = attendance.filter((a) => inM(a.date));
  const khataWorkDays = new Set(month.filter((e) => e.source === "KHATABOOK" && e.kind === "EARNING").map((e) => e.date.toDateString()));
  const present = monthAtt.filter((a) => a.status === "PRESENT").length + khataWorkDays.size;
  const halfDay = monthAtt.filter((a) => a.status === "HALF_DAY").length;
  const given = loanEntries.filter((l) => l.signedAmount > 0).reduce((s, l) => s + l.signedAmount, 0);
  const repaid = -loanEntries.filter((l) => l.signedAmount < 0).reduce((s, l) => s + l.signedAmount, 0);
  return {
    staffId: staff.id,
    name: staff.name,
    cutover: staff.ledgerCutoverAt,
    salaryDue: r2(total(entries)),
    loan: { given: r2(given), paid: r2(repaid), remaining: r2(given - repaid) },
    month: {
      // Salary excludes auto fare (separate ledger line); fare is still owed and inside Salary Due.
      salary: r2(month.filter((e) => e.group === "work" && e.kind !== "AUTO_FARE").reduce((s, e) => s + e.amount, 0)),
      fare: r2(month.filter((e) => e.kind === "AUTO_FARE").reduce((s, e) => s + e.amount, 0)),
      paid: r2(month.filter((e) => e.group === "paid").reduce((s, e) => s + e.amount, 0)),
      present,
      halfDay,
      absent: monthAtt.filter((a) => a.status === "ABSENT").length,
      leave: monthAtt.filter((a) => a.status === "LEAVE").length,
      workDays: present + halfDay * 0.5,
    },
  };
}

/** One year of money history for "My Money": month rows + entry lists + loan. */
export async function getStaffMoneyYear(staffId: string, year: number) {
  const all = await loadAll(staffId);
  if (!all) return null;
  const { entries, loanEntries } = all;
  const y0 = new Date(year, 0, 1);
  const y1 = new Date(year + 1, 0, 1);
  const inY = entries.filter((e) => e.date >= y0 && e.date < y1);
  const before = entries.filter((e) => e.date < y0);
  const months = Array.from({ length: 12 }, (_, m) => {
    const rows = inY.filter((e) => e.date.getMonth() === m);
    const days = new Set(rows.filter((e) => e.group === "work" && (e.kind === "EARNING" || e.kind === "PRESENT" || e.kind === "HALF_DAY")).map((e) => e.date.toDateString()));
    return {
      month: m + 1,
      workDays: days.size,
      salary: r2(rows.filter((e) => e.group === "work" && e.kind !== "AUTO_FARE").reduce((s, e) => s + e.amount, 0)),
      fare: r2(rows.filter((e) => e.kind === "AUTO_FARE").reduce((s, e) => s + e.amount, 0)),
      paid: r2(rows.filter((e) => e.group === "paid").reduce((s, e) => s + e.amount, 0)),
      opening: r2(rows.filter((e) => e.group === "opening").reduce((s, e) => s + e.amount, 0)),
    };
  });
  const loanY = loanEntries.filter((l) => l.date < y1);
  return {
    startBalance: r2(total(before)),
    endBalance: r2(total([...before, ...inY])),
    months,
    work: inY.filter((e) => e.group === "work").reverse(),
    paid: inY.filter((e) => e.group === "paid").reverse(),
    opening: inY.filter((e) => e.group === "opening"),
    loan: {
      entries: loanY.slice().reverse(),
      given: r2(loanY.filter((l) => l.signedAmount > 0).reduce((s, l) => s + l.signedAmount, 0)),
      paid: r2(-loanY.filter((l) => l.signedAmount < 0).reduce((s, l) => s + l.signedAmount, 0)),
    },
  };
}

/** Khata Book work days (imported EARNING dates) between two dates — for the attendance calendar. */
export async function getImportedWorkDays(staffId: string, from: Date, to: Date) {
  const rows = await db.staffLedgerEntry.findMany({ where: { staffId, deletedAt: null, kind: "EARNING", date: { gte: from, lt: to } }, select: { date: true, description: true } });
  return rows;
}
