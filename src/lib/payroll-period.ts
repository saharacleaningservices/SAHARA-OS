// Payroll Summary header — follows the month selected on the staff page (owner 2026-11-06).
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

export function monthName(month: number): string {
  return MONTHS[Math.min(11, Math.max(0, Math.trunc(month) - 1))];
}

/** "Payroll Summary - October 2026" */
export function payrollSummaryTitle(year: number, month: number): string {
  return `Payroll Summary - ${monthName(month)} ${year}`;
}
