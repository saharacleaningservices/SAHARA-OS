// Money Khata rules shared by the calculation engine, the server actions and the UI.

/**
 * Auto Fare is paid to ONE employee only — Kaleem (SCS-0004), owner rule
 * 2026-10-06: Daily Wage + Auto Fare = his total payable. For every other
 * employee Auto Fare is hidden completely and cannot be entered.
 * Employee IDs are permanent (SCS-0001…), so the code is a stable key.
 */
export const AUTO_FARE_EMPLOYEE_CODES: readonly string[] = ["SCS-0004"];

export function autoFareAllowed(employeeCode: string | null | undefined): boolean {
  return !!employeeCode && AUTO_FARE_EMPLOYEE_CODES.includes(employeeCode);
}
