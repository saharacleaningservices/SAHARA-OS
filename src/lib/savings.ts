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
