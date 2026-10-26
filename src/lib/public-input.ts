// Input guards for the public (unauthenticated) booking Server Actions.
// Pure functions only — customers' browsers are never trusted for shape or size.

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written YYYY-MM-DD. */
export function isValidYmd(v: unknown): v is string {
  if (typeof v !== "string" || !YMD.test(v)) return false;
  const d = new Date(`${v}T00:00:00+05:30`);
  return !Number.isNaN(d.getTime()) && d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === v;
}

/** Whole number of days, clamped to 1..max (default 21 when not a number). */
export function clampDays(v: unknown, max = 45, fallback = 21): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
  return Math.min(Math.max(n, 1), max);
}

/** A customer's reschedule/postpone/cancel request: note is text <= 300, date is YYYY-MM-DD or dropped. */
export function sanitizeChangeRequest(note: unknown, preferredDate: unknown) {
  return {
    note: typeof note === "string" ? note.trim().slice(0, 300) : "",
    preferredDate: isValidYmd(preferredDate) ? preferredDate : undefined,
  };
}
