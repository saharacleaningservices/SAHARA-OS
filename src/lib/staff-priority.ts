// Custom staff display order (owner 2026-11-06) — replaces alphabetical sorting in the CRM staff
// lists and the monthly payroll tables.
//
//   Group 1  male monthly-salary staff   Mahesh · Sikandar · Sariful · Giyasuddin · Amir
//   Group 2  female monthly-salary staff Parveen · Shama · Ayesha
//   Group 3  management & accounts       Shoaib Kazi · Francis Montero
//   Group 4  daily wagers                everyone else, in employee-ID order
//
// Matching is by NAME TOKENS (not by employee code) so the order is correct both before and after any
// employee-ID re-sequencing, and survives the Khata / CRM spelling variants (Parvin/Parveen, Shamma/Shama…).

export const STAFF_PRIORITY: readonly { rank: number; group: 1 | 2 | 3; label: string; tokens: readonly string[] }[] = [
  { rank: 1, group: 1, label: "Mahesh Banberu", tokens: ["mahesh"] },
  { rank: 2, group: 1, label: "Sikandar Pathan", tokens: ["sikandar", "sikander"] },
  { rank: 3, group: 1, label: "Sariful Rehman", tokens: ["sariful", "shariful"] },
  { rank: 4, group: 1, label: "Giyasuddin", tokens: ["giyasuddin", "giyashuddin", "giyasoddin", "gyasuddin"] },
  { rank: 5, group: 1, label: "Amir Sheikh", tokens: ["amir"] },
  { rank: 6, group: 2, label: "Parveen Sheikh", tokens: ["parveen", "parvin"] },
  { rank: 7, group: 2, label: "Shama Sheikh", tokens: ["shama", "shamma"] },
  { rank: 8, group: 2, label: "Ayesha Sheikh", tokens: ["ayesha", "aayesha", "ayesa"] },
  { rank: 9, group: 3, label: "Shoaib Kazi", tokens: ["shoaib", "shoyab", "shoeb"] },
  { rank: 10, group: 3, label: "Francis Montero", tokens: ["francis", "fransis", "montero"] },
] as const;

/** Rank for the rest of the team (daily wagers) — always after the 10 named staff. */
export const DAILY_WAGER_RANK = 100;

const tokensOf = (name: string) => name.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);

/** 1…10 for the named staff, DAILY_WAGER_RANK for everyone else. */
export function staffPriorityRank(name: string | null | undefined): number {
  const toks = tokensOf(name ?? "");
  for (const p of STAFF_PRIORITY) if (toks.some((t) => p.tokens.includes(t))) return p.rank;
  return DAILY_WAGER_RANK;
}

/** 1 / 2 / 3 for the named groups, 4 for daily wagers. */
export function staffPriorityGroup(name: string | null | undefined): 1 | 2 | 3 | 4 {
  const rank = staffPriorityRank(name);
  return STAFF_PRIORITY.find((p) => p.rank === rank)?.group ?? 4;
}

/** Stable custom-priority sort: named staff first, then daily wagers by employee code, then name. */
export function sortStaffByPriority<T extends { name: string; employeeCode?: string | null }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    const r = staffPriorityRank(a.name) - staffPriorityRank(b.name);
    if (r) return r;
    const c = (a.employeeCode ?? "￿").localeCompare(b.employeeCode ?? "￿", "en", { numeric: true });
    return c || a.name.localeCompare(b.name, "en");
  });
}
