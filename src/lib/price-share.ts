import { PRICE_GROUP_LABEL, PAINTING_PUBLIC_NOTE, maskPaintingPrices, type FestivalWindow, type PriceGroup, type PriceItem } from "@/lib/pricing-master";
import { formatINR } from "@/lib/utils";

// Price-list sharing: builds the customer-facing WhatsApp text for one service or a whole category.
// Uses the PUBLIC rules — interior-painting rates are never shared (quoted after a free site inspection).

export type ShareItem = {
  id: string;
  name: string;
  priceText: string;
  mrpText: string | null;
  festival: { name: string; text: string }[];
  detail: string;
  share: string;
};
export type ShareGroup = { key: PriceGroup; label: string; items: ShareItem[]; shareAll: string };

const HEAD = "*Sahara Cleaning Services, Pune*";

export function buildShareGroups(items: PriceItem[], festivals: FestivalWindow[], bookUrl: string, today: string): ShareGroup[] {
  const live = festivals.filter((f) => f.end >= today);
  const publicItems = new Map(maskPaintingPrices(items).map((i) => [i.contentId, i]));
  const tail = `Book online (pick your date & slot): ${bookUrl}\nCall / WhatsApp: 7083347130`;
  const groups: ShareGroup[] = [];

  for (const key of Object.keys(PRICE_GROUP_LABEL) as PriceGroup[]) {
    const inGroup = items.filter((i) => i.group === key);
    if (!inGroup.length) continue;

    const rows: ShareItem[] = inGroup.map((i) => {
      const pub = publicItems.get(i.contentId)!;
      const sharePrice = pub.price == null ? (pub.priceNote ?? "Quote after free site inspection") : formatINR(pub.price);
      const shareDetail = [pub.unit, pub.rule].filter(Boolean).join(" · ");
      // Festival prices are shared only where a public price exists (never for painting).
      const festShared = pub.price != null ? live.filter((f) => f.prices[i.contentId] != null) : [];
      const festLine = festShared.length ? `\n${festShared.map((f) => `${f.name} offer: ${formatINR(f.prices[i.contentId])}`).join(" · ")}` : "";
      return {
        id: i.contentId,
        name: i.name,
        priceText: i.price == null ? "After inspection" : formatINR(i.price),
        mrpText: i.mrp ? formatINR(i.mrp) : null,
        festival: live.filter((f) => f.prices[i.contentId] != null).map((f) => ({ name: f.name, text: formatINR(f.prices[i.contentId]) })),
        detail: [i.unit, i.rule].filter(Boolean).join(" · "),
        share: `${HEAD}\n${pub.name}: ${sharePrice}${shareDetail ? ` (${shareDetail})` : ""}${festLine}\n\n${tail}`,
      };
    });

    const body = inGroup
      .map((i) => {
        const pub = publicItems.get(i.contentId)!;
        const price = pub.price == null ? (pub.priceNote ?? PAINTING_PUBLIC_NOTE) : formatINR(pub.price);
        const detail = [pub.unit, pub.rule].filter(Boolean).join(" · ");
        return `• ${i.name} — ${price}${detail ? ` (${detail})` : ""}`;
      })
      .join("\n");
    groups.push({ key, label: PRICE_GROUP_LABEL[key], items: rows, shareAll: `${HEAD}\n*${PRICE_GROUP_LABEL[key]}*\n${body}\n\n${tail}` });
  }
  return groups;
}

export const whatsappShareUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
