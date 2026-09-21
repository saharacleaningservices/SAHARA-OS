"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { reviewSchema } from "@/lib/validation";
import { requireRole } from "@/lib/current-user";

// A Next.js Server Action is a real HTTP endpoint regardless of which page
// links to it — being called only from the authenticated /reports page
// doesn't stop someone who extracts the action reference from calling it
// directly while logged out. Both actions here had no session check at all
// before the 2026-09-21 security audit (an unauthenticated caller could
// have inserted fake reviews or marked any real one as "replied"), despite
// being staff-only features. Matches /reports's own requireRole list.
const REVIEW_ROLES: ("ADMIN" | "ACCOUNTS" | "OPERATIONS" | "SUPERVISOR")[] = ["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"];

/** Staff log a Google review here — there's no ingestion API connected yet. */
export async function createReview(values: unknown) {
  await requireRole(REVIEW_ROLES);
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
  await requireRole(REVIEW_ROLES);
  await db.review.update({
    where: { id },
    data: { replied: true, repliedAt: new Date(), replyNote: replyNote || null },
  });
  revalidatePath("/reports");
  return { success: true as const };
}
