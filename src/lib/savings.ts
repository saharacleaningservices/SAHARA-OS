// Genuine-discount maths for struck-through prices. A saving is shown only when the owner-set MRP
// (Settings → Pricing) is above the price the customer actually pays; otherwise nothing is shown.

export type Savings = { save: number; pct: number };

export function savingsOf(mrp: number | null | undefined, price: number | null | undefined): Savings | null {
  if (mrp == null || price == null || !(mrp > price) || price <= 0) return null;
  return { save: mrp - price, pct: Math.round(((mrp - price) / mrp) * 100) };
}

/** "You Save ₹1,500 (21% OFF)". */
export function savingsLabel(s: Savings): string {
  return `You Save ₹${s.save.toLocaleString("en-IN")} (${s.pct}% OFF)`;
}

/**
 * The only price that may be struck through. During a festival it is the genuine REGULAR price, and only when that
 * is higher than the festival price; outside a festival it is the owner-set MRP (already required to be above the
 * regular price). Anything else returns null, so no invented anchor is ever shown.
 */
export function strikePrice(opts: { festival: number | null | undefined; regular: number | null | undefined; mrp?: number | null }): number | null {
  const { festival, regular, mrp } = opts;
  if (festival != null) return regular != null && regular > festival ? regular : null;
  return mrp != null && regular != null && mrp > regular ? mrp : null;
}
