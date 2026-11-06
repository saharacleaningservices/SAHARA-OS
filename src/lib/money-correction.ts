// Live preview for the ledger "Edit / Correct" dialog (owner 2026-11-06).
// Pure maths shared by the dialog (instant feedback while typing) and the tests; the server action
// (server/actions/staff-money.ts → correctStaffEntry) is the source of truth and recomputes everything
// from the ledger after saving.
//
//   Salary Due     = … − Salary Paid − Advance …   (a Loan never touches it)
//   Loan Remaining = Opening Loan + Loan Given − Loan Recovery
//
// Entry types that can be switched between each other when correcting a mistake:
export const CORRECTABLE_TYPES = ["SALARY", "ADVANCE", "LOAN", "LOAN_RECOVERY"] as const;
export type CorrectableType = (typeof CORRECTABLE_TYPES)[number];
export const CORRECTABLE_LABEL: Record<CorrectableType, string> = {
  SALARY: "Salary paid",
  ADVANCE: "Advance",
  LOAN: "Loan given",
  LOAN_RECOVERY: "Loan recovery",
};

/** Ledger / loan row `kind` → correctable type (null = type cannot be switched: bonus, auto fare, overtime…). */
export function correctableTypeOf(kind: string): CorrectableType | null {
  switch (kind) {
    case "SALARY_PAID":
    case "PAYMENT":
      return "SALARY";
    case "ADVANCE":
      return "ADVANCE";
    case "LOAN_GIVEN":
      return "LOAN";
    case "LOAN_REPAID":
      return "LOAN_RECOVERY";
    default:
      return null;
  }
}

/** Effect of one entry on [Salary Due, Loan Remaining]. Amount is always positive. */
export function entryEffect(type: CorrectableType, amount: number): { salaryDue: number; loan: number } {
  switch (type) {
    case "SALARY":
    case "ADVANCE":
      return { salaryDue: -amount, loan: 0 };
    case "LOAN":
      return { salaryDue: 0, loan: amount };
    case "LOAN_RECOVERY":
      return { salaryDue: 0, loan: -amount };
  }
}

export type CorrectionPreview = {
  salaryDue: number;
  loanRemaining: number;
  salaryDueChange: number;
  loanChange: number;
  /** Loan would go below zero — the server refuses this correction. */
  loanNegative: boolean;
};

/**
 * Salary Due / Loan Remaining AFTER replacing `original` with `next` (next = null → entry cancelled).
 * `current` is what the Khata shows now (it already includes the original entry).
 */
export function previewCorrection(
  current: { salaryDue: number; loanRemaining: number },
  original: { type: CorrectableType; amount: number },
  next: { type: CorrectableType; amount: number } | null,
): CorrectionPreview {
  const was = entryEffect(original.type, original.amount);
  const now = next ? entryEffect(next.type, next.amount) : { salaryDue: 0, loan: 0 };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const salaryDueChange = r2(now.salaryDue - was.salaryDue);
  const loanChange = r2(now.loan - was.loan);
  const loanRemaining = r2(current.loanRemaining + loanChange);
  return { salaryDue: r2(current.salaryDue + salaryDueChange), loanRemaining, salaryDueChange, loanChange, loanNegative: loanRemaining < -0.001 };
}
