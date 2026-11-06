// CRM → Jobs → Slot Availability month matrix (2026-11-06): pure helpers, unit-tested in tests/slot-matrix.test.ts.

/** The five customer-facing 2-hour windows, in order (TIME_SLOTS without "Flexible"). */
export const TWO_HOUR_SLOTS = ["8:00 – 10:00 AM", "10:00 AM – 12:00 PM", "12:00 – 2:00 PM", "2:00 – 4:00 PM", "4:00 – 6:00 PM"] as const;

/** Start hour (24h) of a job time like "10:00 AM", "2:30 PM", "8:00 – 10:00 AM" or "1:00 – 3:00"; null = flexible/unknown. */
export function startHourOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return null;
  let h = Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  const ampm = m[3]?.toUpperCase();
  if (ampm === "PM" && h < 12) h += 12;
  else if (ampm === "AM" && h === 12) h = 0;
  else if (!ampm && h < 7) h += 12; // business windows: "1:00 – 3:00" starts are afternoon
  return h;
}

/** Index 0–4 of the 2-hour window a job time falls in; -1 = flexible / outside 8 AM–6 PM. */
export function slotIndexOf(value: string | null | undefined): number {
  const h = startHourOf(value);
  if (h == null || h < 8 || h >= 18) return -1;
  return Math.floor((h - 8) / 2);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** 35 dates (7 × 5, Monday first) starting the Monday of the week containing `todayIso` (YYYY-MM-DD, IST date). */
export function monthMatrixDates(todayIso: string): string[] {
  const t = new Date(`${todayIso}T00:00:00Z`);
  const mondayOffset = (t.getUTCDay() + 6) % 7;
  const start = new Date(t.getTime() - mondayOffset * 86400000);
  return Array.from({ length: 35 }, (_, i) => iso(new Date(start.getTime() + i * 86400000)));
}
