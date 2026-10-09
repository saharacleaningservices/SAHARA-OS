import { cache } from "react";
import { db } from "@/lib/db";
import { INSPECTION_ONLY_IDS, PRICING_MASTER, maskPaintingPrices, type FestivalWindow, type LivePricing, type PriceItem } from "@/lib/pricing-master";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Live prices for every page, the booking form and the CRM: the catalogue in
 * pricing-master.ts with Super Admin's regular-price edits and active festival
 * offers applied. Falls back to the catalogue if the pricing tables are
 * missing (e.g. before the migration has run) so public pages never break.
 */
export const getLivePricing = cache(async (): Promise<LivePricing> => {
  try {
    const [settings, offers] = await Promise.all([
      db.priceSetting.findMany(),
      db.festivalOffer.findMany({ where: { isActive: true }, include: { prices: true }, orderBy: { startDate: "asc" } }),
    ]);
    const byId = new Map(settings.map((s) => [s.contentId, s]));
    const items: PriceItem[] = PRICING_MASTER.filter((p) => byId.get(p.contentId)?.isActive !== false).map((p) => {
      const s = byId.get(p.contentId);
      if (!s) return p;
      // Inspection-only packages (4 BHK+) stay unpriced even if a Super Admin row exists.
      const price = INSPECTION_ONLY_IDS.has(p.contentId) ? null : s.price ?? p.price;
      // A struck-through MRP must stay above the selling price to be genuine.
      const mrp = s.mrp ?? p.mrp;
      return { ...p, price, mrp: mrp != null && price != null && mrp > price ? mrp : undefined };
    });
    const festivals: FestivalWindow[] = offers.map((o) => ({
      id: o.id,
      name: o.name,
      start: ymd(o.startDate),
      end: ymd(o.endDate),
      prices: Object.fromEntries(o.prices.map((x) => [x.contentId, x.price])),
    }));
    return { items, festivals };
  } catch (e) {
    console.error("[pricing] falling back to catalogue prices:", e);
    return { items: PRICING_MASTER, festivals: [] };
  }
});

/**
 * Pricing for PUBLIC surfaces (booking page/widget, landing pages, public booking action, catalogue feed):
 * identical to getLivePricing() except interior-painting rates are withheld (quoted after a free site
 * inspection). CRM / staff tools keep using getLivePricing().
 */
export const getPublicPricing = cache(async (): Promise<LivePricing> => {
  const live = await getLivePricing();
  return { ...live, items: maskPaintingPrices(live.items) };
});
