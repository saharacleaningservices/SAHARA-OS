import { dedupeByIstDay, istDayKey } from "@/lib/ist-days";
import { db } from "@/lib/db";
import { computeEarned } from "@/server/attendance";
import { autoFareAllowed } from "@/lib/staff-money-rules";

// ─────────────────────────────────────────────────────────────────────────
// Money Khata — the ONE calculation engine for the CRM staff profile, the
// Staff App, salary slips, attendance messages and the Khata import check.
//
// Every money event becomes one entry in exactly one bucket:
//   Earned      imported Khata earnings, attendance wage after the cutover, approved overtime
//   Auto Fare   Kaleem (SCS-0004) only — anyone else's fare counts as Earned and is never shown
//   Bonus       bonus, rewards
//   Adjustment  adjustments / other / expenses owed to the worker (signed)
//   Opening     imported opening balance (signed)
//   Salary Paid salary payments (Khata payments, Money Khata "Salary paid")
//   Advance     advances
//   Deductions  fines, deductions
//
//   Salary Due     = Earned + Auto Fare + Bonus ± Adjustment + Opening − Salary Paid − Advance − Deductions
//   Loan Remaining = Opening Loan + Loan Given − Loan Recovery        (completely separate)
//
// Salary payments never touch the loan; a loan recovery reduces ONLY the loan.
// A correction is a reversal row pointing at the original (counted in the
// original's bucket with the opposite sign) plus, if needed, a new row — the
// original is never edited or deleted. Soft-deleted rows never count.
// Positive Salary Due = Sahara owes the worker; negative = worker owes (advance).
// Imported history covers everything up to Staff.ledgerCutoverAt; native
// attendance/advance/fine/reward records count only after it.
// Salary and advance PAYMENTS come only from the Money Khata ledger — an
// Expenses-page row is company bookkeeping and never counts here, so one
// payment can never be subtracted twice (owner check 2026-10-06).
// ─────────────────────────────────────────────────────────────────────────

export type SalaryBucket = "earned" | "autoFare" | "bonus" | "adjustment" | "opening" | "salaryPaid" | "advance" | "deductions";
export type LoanBucket = "opening" | "given" | "recovery";

export type MoneyEntry = {
  /** StaffLedgerEntry id — only ledger rows can be corrected from the Khata. */
  id?: string;
  date: Date;
  group: "work" | "paid" | "opening";
  amount: number; // positive (opening: signed)
  signed: number; // effect on Salary Due
  bucket: SalaryBucket;
  text: string;
  source: "KHATABOOK" | "APP";
  kind: string;
  reversed?: boolean;
};
export type LoanEntry = {
  id: string;
  date: Date;
  kind: string;
  amount: number;
  signedAmount: number;
  bucket: LoanBucket;
  text: string;
  fromSalary: boolean;
  source: string;
  createdByName: string | null;
  reason: string | null;
  reversed: boolean;
};

// `|| 0` turns −0 into 0 (React would otherwise serialise it as "$-0").
const r2 = (n: number) => Math.round(n * 100) / 100 || 0;
// Months are India-time months whatever the server timezone: an entry stored
// as 31-Dec 18:30 UTC is 1-Jan in India and belongs to January.
const IST_MS = 5.5 * 3600 * 1000;
const istYM = (d: Date) => {
  const x = new Date(d.getTime() + IST_MS);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() };
};
/** Start of an India-time month as an absolute instant (month may overflow, e.g. 12 → next Jan). */
const istMonthStart = (y: number, m: number) => new Date(Date.UTC(y, m, 1) - IST_MS);

function salaryBucket(kind: string, fareOk: boolean): SalaryBucket {
  switch (kind) {
    case "EARNING":
    case "PRESENT":
    case "HALF_DAY":
    case "OVERTIME":
      return "earned";
    case "AUTO_FARE":
      return fareOk ? "autoFare" : "earned";
    case "BONUS":
    case "REWARD":
      return "bonus";
    case "SALARY_PAID":
    case "PAYMENT":
      return "salaryPaid";
    case "ADVANCE":
      return "advance";
    case "FINE":
    case "DEDUCTION":
      return "deductions";
    case "OPENING_BALANCE":
    case "TRANSFER_TO_LOAN":
      return "opening";
    default:
      return "adjustment";
  }
}
function loanBucket(kind: string): LoanBucket {
  if (kind === "LOAN_OPENING") return "opening";
  if (kind === "LOAN_REPAID") return "recovery";
  return "given";
}
const groupOf = (bucket: SalaryBucket, signed: number): MoneyEntry["group"] =>
  bucket === "opening" ? "opening" : signed >= 0 ? "work" : "paid";

async function loadAll(staffId: string) {
  const staff = await db.staff.findUnique({
    where: { id: staffId },
    select: { id: true, name: true, employeeCode: true, salaryType: true, monthlySalary: true, ledgerCutoverAt: true },
  });
  if (!staff) return null;
  const fareOk = autoFareAllowed(staff.employeeCode);
  const cut = staff.ledgerCutoverAt;
  const after = cut ? { gt: cut } : undefined;
  const [ledger, loans, attendance, advances, fines, rewards, overtime] = await Promise.all([
    db.staffLedgerEntry.findMany({
      where: { staffId, deletedAt: null },
      select: { id: true, date: true, kind: true, amount: true, signedAmount: true, description: true, paymentMode: true, reference: true, source: true, reversalOfId: true },
    }),
    db.staffLoanEntry.findMany({
      where: { staffId, deletedAt: null },
      orderBy: { date: "asc" },
      select: { id: true, date: true, kind: true, amount: true, signedAmount: true, fromSalary: true, source: true, description: true, createdByName: true, reversalOfId: true, reason: true },
    }),
    db.attendance.findMany({ where: { staffId, ...(after ? { date: after } : {}) }, select: { date: true, status: true, wageForDay: true, notes: true } }),
    db.advance.findMany({ where: { staffId, ...(after ? { givenAt: after } : {}) }, select: { givenAt: true, amount: true, reason: true } }),
    db.fineRecord.findMany({ where: { staffId, ...(after ? { date: after } : {}) }, select: { date: true, amount: true, type: true, notes: true } }),
    db.rewardRecord.findMany({ where: { staffId, ...(after ? { date: after } : {}) }, select: { date: true, amount: true, type: true } }),
    // Only APPROVED overtime is money owed; pending/rejected never count.
    db.overtimeRecord.findMany({ where: { staffId, deletedAt: null, status: "APPROVED" }, select: { date: true, otHours: true, otAmount: true, reason: true } }),
  ]);

  const entries: MoneyEntry[] = [];
  const push = (e: Omit<MoneyEntry, "group">) => entries.push({ ...e, group: groupOf(e.bucket, e.signed) });

  // Ledger rows (imported Khata + office entries). A reversal counts in its original's bucket.
  const kindById = new Map(ledger.map((l) => [l.id, l.kind]));
  const reversedIds = new Set(ledger.filter((l) => l.reversalOfId).map((l) => l.reversalOfId!));
  for (const l of ledger) {
    const baseKind = l.kind === "REVERSAL" && l.reversalOfId ? (kindById.get(l.reversalOfId) ?? "ADJUSTMENT") : l.kind;
    const bucket = salaryBucket(baseKind, fareOk);
    // Hide Auto Fare completely for everyone except the allowed employee.
    const hideFare = !fareOk && baseKind === "AUTO_FARE";
    push({
      id: l.id,
      date: l.date,
      signed: l.signedAmount,
      amount: bucket === "opening" ? l.signedAmount : Math.abs(l.signedAmount),
      bucket,
      text: hideFare
        ? "Earning"
        : [l.description, l.paymentMode ? l.paymentMode.replace("_", " ") : null, l.reference ? `Ref ${l.reference}` : null].filter(Boolean).join(" · "),
      source: l.source === "KHATABOOK" ? "KHATABOOK" : "APP",
      kind: hideFare ? "EARNING" : l.kind,
      reversed: reversedIds.has(l.id),
    });
  }
  for (const a of attendance) {
    const earned = computeEarned(staff, [a]).earned;
    if (earned > 0) push({ date: a.date, signed: earned, amount: earned, bucket: "earned", text: a.notes ?? (a.status === "HALF_DAY" ? "Half day" : "Work day"), source: "APP", kind: a.status });
  }
  for (const o of overtime) push({ date: o.date, signed: o.otAmount, amount: o.otAmount, bucket: "earned", text: `${o.otHours} h${o.reason ? ` · ${o.reason}` : ""}`, source: "APP", kind: "OVERTIME" });
  for (const r of rewards) push({ date: r.date, signed: r.amount, amount: r.amount, bucket: "bonus", text: r.type, source: "APP", kind: "REWARD" });
  for (const a of advances) push({ date: a.givenAt, signed: -a.amount, amount: a.amount, bucket: "advance", text: a.reason ?? "Advance", source: "APP", kind: "ADVANCE" });
  for (const f of fines) push({ date: f.date, signed: -f.amount, amount: f.amount, bucket: "deductions", text: [f.type, f.notes].filter(Boolean).join(" · "), source: "APP", kind: "FINE" });
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Loan ledger — separate; a correction counts in its original's bucket.
  const loanKindById = new Map(loans.map((l) => [l.id, l.kind]));
  const loanReversed = new Set(loans.filter((l) => l.reversalOfId).map((l) => l.reversalOfId!));
  const loanEntries: LoanEntry[] = loans.map((l) => ({
    id: l.id,
    date: l.date,
    kind: l.kind,
    amount: l.amount,
    signedAmount: l.signedAmount,
    bucket: loanBucket(l.kind === "LOAN_CORRECTION" && l.reversalOfId ? (loanKindById.get(l.reversalOfId) ?? "LOAN_GIVEN") : l.kind),
    text: l.description ?? "",
    fromSalary: l.fromSalary,
    source: l.source,
    createdByName: l.createdByName,
    reason: l.reason,
    reversed: loanReversed.has(l.id),
  }));
  return { staff, fareOk, entries, loanEntries, attendance };
}

const total = (entries: MoneyEntry[]) => entries.reduce((s, e) => s + e.signed, 0);

/** Bucket totals. Money-out buckets (salaryPaid / advance / deductions) are returned as positive amounts. */
export function salarySummary(entries: MoneyEntry[]) {
  const sum = (b: SalaryBucket) => entries.filter((e) => e.bucket === b).reduce((s, e) => s + e.signed, 0);
  return {
    earned: r2(sum("earned")),
    autoFare: r2(sum("autoFare")),
    bonus: r2(sum("bonus")),
    adjustment: r2(sum("adjustment")),
    opening: r2(sum("opening")),
    salaryPaid: r2(-sum("salaryPaid")),
    advance: r2(-sum("advance")),
    deductions: r2(-sum("deductions")),
    salaryDue: r2(total(entries)),
  };
}
export type SalarySummary = ReturnType<typeof salarySummary>;

export function loanSummary(loans: LoanEntry[]) {
  const sum = (b: LoanBucket) => loans.filter((l) => l.bucket === b).reduce((s, l) => s + l.signedAmount, 0);
  const opening = r2(sum("opening"));
  const given = r2(sum("given"));
  const recovered = r2(-sum("recovery"));
  return { opening, given, recovered, paid: recovered, remaining: r2(opening + given - recovered) };
}

export type StaffMoney = NonNullable<Awaited<ReturnType<typeof getStaffMoney>>>;

/** Headline numbers for the Staff App home / CRM / reconciliation. */
export async function getStaffMoney(staffId: string, now = new Date()) {
  const all = await loadAll(staffId);
  if (!all) return null;
  const { staff, fareOk, entries, loanEntries, attendance } = all;
  const nowIst = istYM(now);
  const m0 = istMonthStart(nowIst.y, nowIst.m);
  const m1 = istMonthStart(nowIst.y, nowIst.m + 1);
  const inM = (d: Date) => d >= m0 && d < m1;
  const month = entries.filter((e) => inM(e.date));
  // One record per India day: duplicates of the same day collapse (a day is never counted twice), and an
  // imported Khata work day counts only when the app has no record for that same day.
  const monthAtt = dedupeByIstDay(attendance.filter((a) => inM(a.date)));
  const nativeDays = new Set(monthAtt.map((a) => istDayKey(a.date)));
  const khataOnlyDays = new Set(month.filter((e) => e.source === "KHATABOOK" && e.kind === "EARNING").map((e) => istDayKey(e.date)).filter((k) => !nativeDays.has(k)));
  const countStatus = (st: string) => monthAtt.filter((a) => a.status === st).length;
  const present = countStatus("PRESENT") + khataOnlyDays.size;
  const halfDay = countStatus("HALF_DAY");
  const summary = salarySummary(entries);
  return {
    staffId: staff.id,
    name: staff.name,
    employeeCode: staff.employeeCode,
    autoFareEnabled: fareOk,
    cutover: staff.ledgerCutoverAt,
    salaryDue: summary.salaryDue,
    summary,
    loan: loanSummary(loanEntries),
    month: {
      // Salary excludes auto fare (its own line, Kaleem only); fare is still owed and inside Salary Due.
      salary: r2(month.filter((e) => e.group === "work" && e.bucket !== "autoFare").reduce((s, e) => s + e.amount, 0)),
      fare: r2(month.filter((e) => e.bucket === "autoFare").reduce((s, e) => s + e.signed, 0)),
      paid: r2(month.filter((e) => e.group === "paid").reduce((s, e) => s + e.amount, 0)),
      present,
      halfDay,
      absent: countStatus("ABSENT"),
      leave: countStatus("LEAVE"),
      // Weekly off is a recorded day too — without it a 10-day record (8 worked + 2 off) read as "8".
      weeklyOff: countStatus("WEEKLY_OFF"),
      /** Every day with a record this month (present, half, absent, leave, weekly off, imported work days). */
      recorded: monthAtt.length + khataOnlyDays.size,
      workDays: present + halfDay * 0.5,
    },
  };
}

/** One India-time month from the same engine — salary slips, attendance messages, monthly reports. */
export async function getStaffMoneyMonth(staffId: string, year: number, month: number) {
  const all = await loadAll(staffId);
  if (!all) return null;
  const m0 = istMonthStart(year, month - 1);
  const m1 = istMonthStart(year, month);
  const before = all.entries.filter((e) => e.date < m0);
  const inMonth = all.entries.filter((e) => e.date >= m0 && e.date < m1);
  const s = salarySummary(inMonth);
  const openingDue = r2(total(before));
  return {
    autoFareEnabled: all.fareOk,
    openingDue,
    ...s,
    monthNet: s.salaryDue,
    closingDue: r2(openingDue + s.salaryDue),
    loan: loanSummary(all.loanEntries.filter((l) => l.date < m1)),
    khataWorkDays: new Set(inMonth.filter((e) => e.source === "KHATABOOK" && e.kind === "EARNING").map((e) => istDayKey(e.date))).size,
  };
}

/** One year of money history for "My Money" / the office Khata: month rows + entry lists + loan. */
export async function getStaffMoneyYear(staffId: string, year: number) {
  const all = await loadAll(staffId);
  if (!all) return null;
  const { entries, loanEntries } = all;
  const y0 = istMonthStart(year, 0);
  const y1 = istMonthStart(year + 1, 0);
  const inY = entries.filter((e) => e.date >= y0 && e.date < y1);
  const before = entries.filter((e) => e.date < y0);
  const months = Array.from({ length: 12 }, (_, m) => {
    const rows = inY.filter((e) => istYM(e.date).m === m);
    const days = new Set(rows.filter((e) => e.bucket === "earned" && (e.kind === "EARNING" || e.kind === "PRESENT" || e.kind === "HALF_DAY")).map((e) => istDayKey(e.date)));
    return {
      month: m + 1,
      workDays: days.size,
      salary: r2(rows.filter((e) => e.group === "work" && e.bucket !== "autoFare").reduce((s, e) => s + e.amount, 0)),
      fare: r2(rows.filter((e) => e.bucket === "autoFare").reduce((s, e) => s + e.signed, 0)),
      paid: r2(rows.filter((e) => e.group === "paid").reduce((s, e) => s + e.amount, 0)),
      opening: r2(rows.filter((e) => e.group === "opening").reduce((s, e) => s + e.amount, 0)),
    };
  });
  // Khata-style ledger with running balance (oldest first, then shown newest first).
  let run = total(before);
  const lines = inY.map((e) => {
    run += e.signed;
    return {
      id: e.id ?? null,
      date: e.date,
      text: e.text,
      kind: e.kind,
      bucket: e.bucket,
      source: e.source,
      credit: e.signed > 0 ? Math.abs(e.signed) : 0,
      debit: e.signed < 0 ? Math.abs(e.signed) : 0,
      balance: r2(run),
      reversed: !!e.reversed,
    };
  });
  const loanY = loanEntries.filter((l) => l.date < y1);
  const loanSum = loanSummary(loanY);
  return {
    startBalance: r2(total(before)),
    endBalance: r2(total([...before, ...inY])),
    months,
    work: inY.filter((e) => e.group === "work").reverse(),
    paid: inY.filter((e) => e.group === "paid").reverse(),
    opening: inY.filter((e) => e.group === "opening"),
    lines: lines.reverse(),
    loan: { entries: loanY.slice().reverse(), ...loanSum },
  };
}

/** Khata Book work days (imported EARNING dates) between two dates — for the attendance calendar. */
export async function getImportedWorkDays(staffId: string, from: Date, to: Date) {
  const rows = await db.staffLedgerEntry.findMany({ where: { staffId, deletedAt: null, kind: "EARNING", date: { gte: from, lt: to } }, select: { date: true, description: true } });
  return rows;
}
