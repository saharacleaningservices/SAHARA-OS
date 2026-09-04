import { db } from "@/lib/db";

export async function getUpsellOfferForCategory(triggerCategory: string) {
  return db.upsellRule.findFirst({ where: { triggerCategory: triggerCategory as never, isActive: true } });
}

export async function recordUpsellEvent(input: {
  ruleId: string | null;
  leadId: string | null;
  label: string;
  comboValue: number | null;
  accepted: boolean;
}) {
  return db.upsellEvent.create({
    data: {
      ruleId: input.ruleId,
      leadId: input.leadId,
      label: input.label,
      comboValue: input.comboValue,
      accepted: input.accepted,
      acceptedAt: input.accepted ? new Date() : null,
    },
  });
}

export async function getUpsellConversionStats() {
  const events = await db.upsellEvent.findMany();
  const shown = events.length;
  const accepted = events.filter((e) => e.accepted).length;
  const revenue = events.filter((e) => e.accepted).reduce((s, e) => s + (e.comboValue ?? 0), 0);
  return { shown, accepted, revenue, conversionRate: shown > 0 ? Math.round((accepted / shown) * 1000) / 10 : 0 };
}
