// Invoice tax + discount engine (owner brief 2026-10-22).
//   Final Total = (Subtotal - Discount) + 18% GST (only when GST is enabled)
// Discount is either a flat amount (₹) or a percentage of the subtotal. GST is OFF by default (B2C) and is switched on
// for B2B bookings, where it is shown as CGST 9% + SGST 9%. All money is rounded to the paisa.

export const GST_RATE = 18;

export type DiscountInput = { mode: "FLAT" | "PERCENT"; value: number } | null | undefined;

export type InvoiceTotals = {
  subtotal: number;
  discount: number;
  taxable: number;
  gstEnabled: boolean;
  cgst: number;
  sgst: number;
  gst: number;
  total: number;
  advancePaid: number;
  balanceDue: number;
};

const paisa = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** The discount in rupees: never negative, never more than the subtotal; a percentage is capped at 100. */
export function discountAmount(subtotal: number, d: DiscountInput): number {
  if (!d || !(d.value > 0) || !(subtotal > 0)) return 0;
  const raw = d.mode === "PERCENT" ? (subtotal * Math.min(d.value, 100)) / 100 : d.value;
  return paisa(Math.min(Math.max(raw, 0), subtotal));
}

export function computeInvoiceTotals(input: { subtotal: number; discount?: DiscountInput; gstEnabled?: boolean; advancePaid?: number }): InvoiceTotals {
  const subtotal = paisa(Math.max(0, input.subtotal));
  const discount = discountAmount(subtotal, input.discount);
  const taxable = paisa(subtotal - discount);
  const gstEnabled = !!input.gstEnabled;
  const cgst = gstEnabled ? paisa((taxable * GST_RATE) / 2 / 100) : 0;
  const sgst = gstEnabled ? paisa((taxable * GST_RATE) / 2 / 100) : 0;
  const gst = paisa(cgst + sgst);
  const total = paisa(taxable + gst);
  const advancePaid = paisa(Math.max(0, input.advancePaid ?? 0));
  return { subtotal, discount, taxable, gstEnabled, cgst, sgst, gst, total, advancePaid, balanceDue: paisa(Math.max(0, total - advancePaid)) };
}

/** 15-character GSTIN shape check (state code, PAN, entity, Z, checksum char) — format only, not a registry lookup. */
export const GSTIN_PATTERN = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const isValidGstin = (g: string | null | undefined) => !!g && GSTIN_PATTERN.test(g.trim().toUpperCase());

/**
 * Re-bill a job from its stored numbers. Job.jobValue is the final payable total, so the gross subtotal is recovered as
 * (jobValue − current GST) + current discount; changing the discount or the GST toggle never compounds on a previous edit.
 */
export function rebillJob(
  current: { jobValue: number; gstAmount?: number | null; discountAmount?: number | null },
  next: { discount: DiscountInput; gstEnabled: boolean; advancePaid?: number },
): InvoiceTotals {
  const subtotal = paisa(Math.max(0, current.jobValue - (current.gstAmount ?? 0) + (current.discountAmount ?? 0)));
  return computeInvoiceTotals({ subtotal, discount: next.discount, gstEnabled: next.gstEnabled, advancePaid: next.advancePaid });
}
