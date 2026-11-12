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

/**
 * Anchor ("was") price shown next to a selling price (owner decision 2026-11-12): about 20% above the live selling price,
 * rounded to a clean ₹50 step or the matching x49 / x99 step. Computed from the price actually charged, so it follows
 * Super Admin price overrides. Switch every anchor off with NEXT_PUBLIC_ANCHOR_PRICES=off.
 * Examples: 5,499 → 6,599 · 1,999 → 2,399 · 599 → 699 · 199 → 249.
 */
export function anchorPrice(price: number | null | undefined): { was: number; pct: number } | null {
  if (price == null || !(price >= 99) || process.env.NEXT_PUBLIC_ANCHOR_PRICES === "off") return null;
  const raw = price * 1.2;
  let best = 0;
  for (let k = Math.floor(raw / 50) - 1; k <= Math.ceil(raw / 50) + 1; k++) {
    for (const c of [k * 50, k * 50 - 1]) {
      if (c <= price * 1.1) continue;
      if (!best || Math.abs(c - raw) < Math.abs(best - raw)) best = c;
    }
  }
  return best > price ? { was: best, pct: Math.round(((best - price) / best) * 100) } : null;
}
