"use server";

import { getPublicPricing } from "@/server/pricing";
import type { AddOn } from "@/lib/zonal-moq";

/**
 * Add-ons the quick booking modal may suggest to reach the zonal minimum order (Phase 2, 2026-11-02): combo packages and
 * individual services with a fixed public price. Read-only public data — the same prices the booking server re-prices with.
 */
export async function getQuickAddOns(): Promise<AddOn[]> {
  try {
    const pricing = await getPublicPricing();
    return pricing.items
      .filter((i) => (i.group === "COMBO" || i.group === "CUSTOMISED") && i.price != null && i.price > 0)
      .map((i) => ({ contentId: i.contentId, name: i.name, price: i.price!, minQty: Math.max(1, i.minQty ?? 1) }));
  } catch {
    return [];
  }
}
