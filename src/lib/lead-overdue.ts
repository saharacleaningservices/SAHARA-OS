// /leads Overdue badge rule (owner 2026-11-06): a lead whose work is done or whose payment is received is never
// "Overdue", even if its follow-up / service date is in the past.
export const CLOSED_STAGES_FOR_OVERDUE = new Set(["COMPLETED"]);

/** True when every recorded payment of the lead is PAID (and there is at least one). */
export function isLeadPaid(payments: { status: string }[] | null | undefined) {
  return !!payments && payments.length > 0 && payments.every((p) => p.status === "PAID");
}

/** Whether an OVERDUE date bucket should show the red Overdue badge / count for this lead. */
export function showOverdue(stage: string, paid: boolean | null | undefined) {
  return !CLOSED_STAGES_FOR_OVERDUE.has(stage) && !paid;
}
