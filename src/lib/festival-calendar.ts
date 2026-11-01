// All-India festival calendar for the Festival Engine (2026-11-01). Pure date logic — no prices, no slot counts.
// The festival DAY is the countdown target; `leadDays` is how many days before it the effect + notice appear;
// `afterDays` keeps the effect running for the days that follow. Lunar dates (Eid, Diwali, Ganpati…) move every year:
// review this table each autumn — a year with no entry simply shows no effect (never a wrong one).

export type FestivalKind = "diwali" | "ganpati" | "eid" | "christmas-newyear" | "badge";

export type FestivalDef = {
  id: string;
  name: string;
  kind: FestivalKind;
  /** Festival day, IST, YYYY-MM-DD (the countdown target). */
  date: string;
  leadDays: number;
  afterDays: number;
  emoji: string;
  /** Short line shown in the announcement widget — facts only. */
  line: string;
};

export const FESTIVALS: FestivalDef[] = [
  { id: "ganpati-2026", name: "Ganpati Utsav", kind: "ganpati", date: "2026-09-14", leadDays: 10, afterDays: 10, emoji: "🌺", line: "Ganpati Utsav is here — get your home festival-ready." },
  { id: "dussehra-2026", name: "Dussehra", kind: "badge", date: "2026-10-20", leadDays: 7, afterDays: 1, emoji: "🏹", line: "Dussehra greetings from Sahara Cleaning Services." },
  { id: "diwali-2026", name: "Dhanteras & Diwali", kind: "diwali", date: "2026-11-08", leadDays: 22, afterDays: 2, emoji: "🪔", line: "Festival dates are our busiest — book early to lock your preferred slot." },
  { id: "christmas-2026", name: "Christmas & New Year", kind: "christmas-newyear", date: "2026-12-25", leadDays: 10, afterDays: 7, emoji: "🎄", line: "Start the new year with a fresh, spotless home or office." },
  { id: "eid-fitr-2027", name: "Eid-ul-Fitr", kind: "eid", date: "2027-03-10", leadDays: 10, afterDays: 3, emoji: "🌙", line: "Eid Mubarak — get your home guest-ready." },
  { id: "eid-adha-2027", name: "Eid-ul-Adha", kind: "eid", date: "2027-05-17", leadDays: 7, afterDays: 3, emoji: "🌙", line: "Eid Mubarak from Sahara Cleaning Services." },
  { id: "ganpati-2027", name: "Ganpati Utsav", kind: "ganpati", date: "2027-09-04", leadDays: 10, afterDays: 10, emoji: "🌺", line: "Ganpati Utsav is here — get your home festival-ready." },
  { id: "dussehra-2027", name: "Dussehra", kind: "badge", date: "2027-10-18", leadDays: 7, afterDays: 1, emoji: "🏹", line: "Dussehra greetings from Sahara Cleaning Services." },
  { id: "diwali-2027", name: "Dhanteras & Diwali", kind: "diwali", date: "2027-10-29", leadDays: 22, afterDays: 2, emoji: "🪔", line: "Festival dates are our busiest — book early to lock your preferred slot." },
  { id: "christmas-2027", name: "Christmas & New Year", kind: "christmas-newyear", date: "2027-12-25", leadDays: 10, afterDays: 7, emoji: "🎄", line: "Start the new year with a fresh, spotless home or office." },
];

const DAY = 86_400_000;
const istYmd = (now: number) => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
const ymdMs = (ymd: string) => Date.parse(`${ymd}T00:00:00+05:30`);

export type ActiveFestival = FestivalDef & {
  /** True from the lead-in until the festival day inclusive; false in the "after" days. */
  upcoming: boolean;
  /** Festival day start, epoch ms (IST midnight) — countdown target. */
  targetMs: number;
};

/** The festival whose window contains `now` (closest festival day wins), or null. */
export function activeFestival(now: number = Date.now(), list: FestivalDef[] = FESTIVALS): ActiveFestival | null {
  const today = ymdMs(istYmd(now));
  let best: ActiveFestival | null = null;
  let bestDist = Infinity;
  for (const f of list) {
    const day = ymdMs(f.date);
    const diff = Math.round((day - today) / DAY); // days until the festival (negative = already passed)
    if (diff > f.leadDays || diff < -f.afterDays) continue;
    const dist = Math.abs(diff);
    if (dist < bestDist) {
      bestDist = dist;
      best = { ...f, upcoming: diff >= 0, targetMs: day };
    }
  }
  return best;
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number; done: boolean };

/** Time left until the festival day starts (IST midnight). */
export function countdownTo(targetMs: number, now: number = Date.now()): Countdown {
  const left = Math.max(0, targetMs - now);
  return {
    days: Math.floor(left / DAY),
    hours: Math.floor((left % DAY) / 3_600_000),
    minutes: Math.floor((left % 3_600_000) / 60_000),
    seconds: Math.floor((left % 60_000) / 1000),
    done: left === 0,
  };
}
