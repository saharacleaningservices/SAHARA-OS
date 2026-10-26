// Indian financial year (1 April – 31 March), computed in IST so a late-night invoice lands in the right year on a UTC server.
const IST_MS = 5.5 * 3600 * 1000;

/** "2024-25" for any date between 1 Apr 2024 and 31 Mar 2025 (IST). */
export function fyOf(date: Date): string {
  const ist = new Date(date.getTime() + IST_MS);
  const y = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export const isFy = (s: string | null | undefined): s is string => {
  const m = /^(\d{4})-(\d{2})$/.exec(s ?? "");
  return !!m && Number(m[2]) === (Number(m[1]) + 1) % 100 && Number(m[1]) >= 2000 && Number(m[1]) <= 2100;
};

/** [from, to) in real instants: 1 Apr 00:00 IST to the next 1 Apr 00:00 IST. */
export function fyRange(fy: string): { from: Date; to: Date } {
  const y = Number(fy.slice(0, 4));
  return { from: new Date(Date.UTC(y, 3, 1) - IST_MS), to: new Date(Date.UTC(y + 1, 3, 1) - IST_MS) };
}

/** "FY 24-25" */
export const fyLabel = (fy: string) => `FY ${fy.slice(2, 4)}-${fy.slice(5)}`;

/** Newest first, from the first year the CRM / MyBillBook history covers (FY 22-23) to the current one. */
export function fyOptions(now = new Date(), first = 2022): string[] {
  const current = Number(fyOf(now).slice(0, 4));
  return Array.from({ length: current - first + 1 }, (_, i) => {
    const y = current - i;
    return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  });
}
