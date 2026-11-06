// Per-day pay rule (owner 2026-11-06):
//   Daily wager  → per-day = daily wage; total = days worked × daily wage (no month division).
//   Monthly staff → per-day = monthly salary ÷ days in THAT calendar month (30 for a 30-day month, 31 for a 31-day
//                   month, 28/29 for February), month taken in IST.
const IST_MS = 5.5 * 3600 * 1000;

/** Days in the calendar month (IST) that `date` falls in. */
export function daysInMonthIst(date: Date): number {
  const x = new Date(date.getTime() + IST_MS);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
}

export type PayStaff = { salaryType: string; dailyWage: number | null; monthlySalary: number | null };

/** Per-day rate for the day `date` (defaults to today). */
export function perDayRate(staff: PayStaff | null | undefined, date: Date = new Date()): number {
  if (!staff) return 0;
  if (staff.salaryType === "DAILY") return staff.dailyWage ?? 0;
  return staff.monthlySalary ? staff.monthlySalary / daysInMonthIst(date) : 0;
}
