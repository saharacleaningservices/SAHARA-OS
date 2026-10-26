// India-time calendar helpers for attendance and payroll.
//
// Attendance rows are stored as an instant (usually IST midnight = 18:30 UTC the day before). Reading
// them with server-local `new Date(y, m, d)` / `getDate()` / `toDateString()` only works while the server
// clock is IST: on any other timezone the 1st of the month falls out of range and days shift by one.
// Everything here works on the India calendar day regardless of the server timezone.

export const IST_MS = 5.5 * 3600 * 1000;

/** "YYYY-MM-DD" of the India-time calendar day this instant falls on. */
export const istDayKey = (d: Date | string | number): string => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);

/** Start of an India-time calendar month as an absolute instant (month is 1–12; may overflow, e.g. 13 → next January). */
export const istMonthStart = (year: number, month1: number): Date => new Date(Date.UTC(year, month1 - 1, 1) - IST_MS);

/** [from, to) instants of one India-time month (month is 1–12). */
export const istMonthRange = (year: number, month1: number) => ({ from: istMonthStart(year, month1), to: istMonthStart(year, month1 + 1) });

/** [from, to) instants of one India-time year. */
export const istYearRange = (year: number) => ({ from: istMonthStart(year, 1), to: istMonthStart(year + 1, 1) });

/** [from, to) instants of the India-time day this instant falls on. */
export const istDayRange = (d: Date | string | number) => {
  const [y, m, day] = istDayKey(d).split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, day) - IST_MS);
  return { from, to: new Date(from.getTime() + 24 * 3600 * 1000) };
};

export const istDaysInMonth = (year: number, month1: number): number => new Date(Date.UTC(year, month1, 0)).getUTCDate();

/** 0 = Sunday … 6 = Saturday, for a calendar date (month is 1–12). */
export const istWeekday = (year: number, month1: number, day: number): number => new Date(Date.UTC(year, month1 - 1, day)).getUTCDay();

/** 1–12 month of the India-time day this instant falls on. */
export const istMonthOf = (d: Date | string | number): number => Number(istDayKey(d).slice(5, 7));

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const isoOf = (year: number, month1: number, day: number) => `${year}-${pad2(month1)}-${pad2(day)}`;

// One attendance record per India day. If more than one row exists for the same day (rows written under
// different server timezones, or a re-keyed day) the most "worked" status wins, so a day is never counted twice
// and a present day is never hidden behind a stale absent row.
const PRIORITY: Record<string, number> = { PRESENT: 5, HALF_DAY: 4, LEAVE: 3, WEEKLY_OFF: 2, ABSENT: 1 };

export function dedupeByIstDay<T extends { date: Date; status: string }>(rows: T[]): T[] {
  const byDay = new Map<string, T>();
  for (const r of rows) {
    const k = istDayKey(r.date);
    const prev = byDay.get(k);
    if (!prev || (PRIORITY[r.status] ?? 0) > (PRIORITY[prev.status] ?? 0)) byDay.set(k, r);
  }
  return [...byDay.values()];
}
