import { createHash } from "node:crypto";
import { getPublicPricing } from "@/server/pricing";
import { FESTIVAL_PACKAGE_IDS, INSPECTION_ONLY_IDS, activeCampaign, festivalForDate, todayIST, unitPriceFor } from "@/lib/pricing-master";
import { savingsLabel, savingsOf, strikePrice } from "@/lib/savings";
import { festivalUrgency } from "@/lib/festival-urgency";
import { smallServiceScope } from "@/lib/service-scope";

// Display-ready catalogue for the public API (GET /api/public/v1/catalogue). Everything the website needs to render a
// price is computed HERE, from the same pricing master and honest-pricing helpers the booking wizard uses, so the website
// holds no pricing logic and can never show an anchor price that is not real:
//   price        what the customer pays for `serviceDate` (festival price only when that date is inside a festival window)
//   strikePrice  non-null ONLY when a genuinely higher regular price (or owner-set MRP) exists
//   badge        "You Save ₹x (y% OFF)" when struck through, "<Festival> special" for a festival price with no real anchor
// Painting is never priced publicly (getPublicPricing masks it) and inspection-only packages carry no price at all.

export async function buildPublicCatalogue(serviceDate?: string) {
  const today = todayIST();
  const date = serviceDate || today;
  const pricing = await getPublicPricing();
  const festival = festivalForDate(pricing.festivals, date);
  const campaign = activeCampaign(pricing.festivals, today);

  const items = pricing.items.map((i) => {
    const inspectionOnly = INSPECTION_ONLY_IDS.has(i.contentId);
    const price = unitPriceFor(i, festival);
    const festivalPrice = festival && festival.prices[i.contentId] != null ? festival.prices[i.contentId] : null;
    const strike = price == null ? null : strikePrice({ festival: festivalPrice, regular: i.price, mrp: i.mrp });
    const sv = strike != null ? savingsOf(strike, price) : null;
    const badge = sv ? savingsLabel(sv) : festivalPrice != null && festival ? `${festival.name} special` : null;
    return {
      contentId: i.contentId,
      name: i.name,
      category: i.category,
      group: i.group,
      variant: i.variant,
      bhk: i.bhk ?? null,
      unit: i.unit ?? null,
      minQty: i.minQty ?? null,
      addOnOnly: !!i.addOnOnly,
      price,
      strikePrice: sv ? strike : null,
      savings: sv ? sv.save : null,
      badge,
      priceNote: price == null ? i.priceNote ?? (inspectionOnly ? "Quoted after a free site inspection" : null) : null,
      inspectionOnly,
      festivalPackage: FESTIVAL_PACKAGE_IDS.has(i.contentId),
      scope: smallServiceScope(i.contentId),
    };
  });

  const body = {
    serviceDate: date,
    festival: festival ? { name: festival.name, start: festival.start, end: festival.end } : null,
    // While a festival campaign runs, festival packages are bookable only for festival service dates (the booking logic enforces it).
    campaign: campaign ? { start: campaign.start, end: campaign.end } : null,
    demandWindow: festivalUrgency(today),
    items,
  };
  const version = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
  return { version, ...body };
}
