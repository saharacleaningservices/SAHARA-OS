"use server";

import { getUpsellOfferForCategory } from "@/server/upsell";

/** Client-callable lookup for the combo offer to show during booking, if any. */
export async function fetchUpsellOffer(triggerCategory: string) {
  const rule = await getUpsellOfferForCategory(triggerCategory);
  if (!rule) return null;
  return {
    id: rule.id,
    label: rule.label,
    comboCategory: rule.comboCategory,
    comboVariant: rule.comboVariant,
    comboPrice: rule.comboPrice,
  };
}
