"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/current-user";
import { ACQUISITION_CHANNELS } from "@/lib/attribution";

const spendSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM"),
  channel: z.enum(ACQUISITION_CHANNELS),
  campaign: z.string().max(120).optional().default(""),
  amount: z.coerce.number().positive("Amount must be more than 0"),
  notes: z.string().max(300).optional(),
});

/** Owner enters actual monthly ad spend per channel/campaign (from the ad platform invoices). */
export async function addMarketingSpend(formData: FormData) {
  await requireRole(["ADMIN"]);
  const parsed = spendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await db.marketingSpend.create({ data: { ...parsed.data, campaign: parsed.data.campaign.trim() } });
  revalidatePath("/profit/marketing");
}
