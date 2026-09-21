"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { reviewSchema } from "@/lib/validation";

/** Staff log a Google review here — there's no ingestion API connected yet. */
export async function createReview(values: unknown) {
  const parsed = reviewSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;

  await db.review.create({
    data: {
      customerMobile: data.customerMobile,
      customerName: data.customerName || null,
      rating: data.rating,
      comment: data.comment || null,
    },
  });

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { success: true as const };
}

/** Marks a review as replied-to on Google, with an optional note on what was said. */
export async function markReviewReplied(id: string, replyNote?: string) {
  await db.review.update({
    where: { id },
    data: { replied: true, repliedAt: new Date(), replyNote: replyNote || null },
  });
  revalidatePath("/reports");
  return { success: true as const };
}
