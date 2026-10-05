"use server";

// Super Admin → Pricing & Packages. Only ADMIN may change prices; every change
// is audit-logged. Bookings keep the amount they were confirmed at, so edits
// here never alter existing leads/jobs.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logAudit } from "@/server/audit";
import { PRICING_MASTER } from "@/lib/pricing-master";
import { getLivePricing } from "@/server/pricing";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const toDay = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

async function requireSuperAdmin() {
  const session = await getSession();
  return session?.role === "ADMIN" ? session : null;
}

function refresh() {
  for (const p of ["/settings/pricing", "/leads/price-list", "/booking", "/book", "/offers", "/home-deep-cleaning-pune", "/commercial-cleaning-pune", "/interior-painting-pune", "/pest-control-pune"]) revalidatePath(p);
}

export async function getPricingAdminData() {
  if (!(await requireSuperAdmin())) return null;
  const [settings, festivals] = await Promise.all([
    db.priceSetting.findMany(),
    db.festivalOffer.findMany({ include: { prices: true }, orderBy: { startDate: "asc" } }),
  ]);
  return {
    settings: settings.map((s) => ({ contentId: s.contentId, price: s.price, mrp: s.mrp, isActive: s.isActive, updatedByName: s.updatedByName, updatedAt: s.updatedAt.toISOString() })),
    festivals: festivals.map((f) => ({
      id: f.id,
      name: f.name,
      start: f.startDate.toISOString().slice(0, 10),
      end: f.endDate.toISOString().slice(0, 10),
      isActive: f.isActive,
      prices: Object.fromEntries(f.prices.map((p) => [p.contentId, p.price])),
    })),
  };
}

const priceSchema = z.object({
  contentId: z.string().refine((id) => PRICING_MASTER.some((p) => p.contentId === id), "Unknown item"),
  price: z.number().min(0).max(10_000_000).nullable(),
  mrp: z.number().min(0).max(10_000_000).nullable(),
  isActive: z.boolean(),
});

/** Save the regular price / MRP / visibility of one catalogue item. */
export async function savePriceSetting(values: unknown) {
  const session = await requireSuperAdmin();
  if (!session) return { error: "Only Super Admin can change prices." };
  const parsed = priceSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid price" };
  const { contentId, price, mrp, isActive } = parsed.data;
  if (mrp != null && price != null && mrp <= price) return { error: "MRP must be higher than the selling price (or leave it empty)." };
  const before = await db.priceSetting.findUnique({ where: { contentId } });
  await db.priceSetting.upsert({
    where: { contentId },
    create: { contentId, price, mrp, isActive, updatedByName: session.name },
    update: { price, mrp, isActive, updatedByName: session.name },
  });
  const item = PRICING_MASTER.find((p) => p.contentId === contentId)!;
  await logAudit({
    entityType: "Pricing",
    entityId: contentId,
    action: "PRICE_UPDATE",
    summary: `${item.name}: regular ₹${before?.price ?? item.price ?? "—"} → ₹${price ?? "—"}${isActive ? "" : " (hidden)"}`,
    session,
    meta: { before, after: { price, mrp, isActive } },
  });
  refresh();
  return { ok: true };
}

const festivalSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Festival name is required").max(60),
  start: z.string().regex(DATE, "Pick a start date"),
  end: z.string().regex(DATE, "Pick an end date"),
  isActive: z.boolean(),
  prices: z.record(z.string(), z.number().min(0).max(10_000_000).nullable()),
});

/** Create or update a festival offer and its per-item festival prices. */
export async function saveFestivalOffer(values: unknown) {
  const session = await requireSuperAdmin();
  if (!session) return { error: "Only Super Admin can change festival pricing." };
  const parsed = festivalSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid festival" };
  const { id, name, start, end, isActive, prices } = parsed.data;
  if (end < start) return { error: "End date must be on or after the start date." };
  const unknown = Object.keys(prices).find((cid) => !PRICING_MASTER.some((p) => p.contentId === cid));
  if (unknown) return { error: "Unknown item in festival prices." };

  const others = await db.festivalOffer.findMany({ where: { isActive: true, ...(id ? { NOT: { id } } : {}) } });
  const clash = isActive && others.find((o) => start <= o.endDate.toISOString().slice(0, 10) && end >= o.startDate.toISOString().slice(0, 10));
  if (clash) return { error: `Dates overlap with the active "${clash.name}" offer — adjust one of them.` };

  const entries = Object.entries(prices).filter(([, v]) => v != null) as [string, number][];
  const saved = await db.$transaction(async (tx) => {
    const offer = id
      ? await tx.festivalOffer.update({ where: { id }, data: { name, startDate: toDay(start), endDate: toDay(end), isActive, updatedByName: session.name } })
      : await tx.festivalOffer.create({ data: { name, startDate: toDay(start), endDate: toDay(end), isActive, updatedByName: session.name } });
    await tx.festivalPrice.deleteMany({ where: { festivalId: offer.id } });
    if (entries.length) await tx.festivalPrice.createMany({ data: entries.map(([contentId, price]) => ({ festivalId: offer.id, contentId, price })) });
    return offer;
  });
  await logAudit({
    entityType: "Pricing",
    entityId: saved.id,
    action: id ? "FESTIVAL_UPDATE" : "FESTIVAL_CREATE",
    summary: `${name} ${start} → ${end}${isActive ? "" : " (inactive)"} · ${entries.length} festival price(s)`,
    session,
    meta: { prices: Object.fromEntries(entries) },
  });
  refresh();
  return { ok: true, id: saved.id };
}

/** Live catalogue for CRM pickers (quotation dialog) — any signed-in office user. */
export async function getCatalogueForCrm() {
  const session = await getSession();
  if (!session || session.role === "STAFF") return null;
  return getLivePricing();
}
