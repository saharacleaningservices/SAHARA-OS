import { db } from "@/lib/db";

export type TimelineKind =
  | "NOTE"
  | "VOICE"
  | "CALL"
  | "STAGE"
  | "QUOTATION"
  | "JOB"
  | "PAYMENT"
  | "FOLLOW_UP"
  | "SYSTEM";

/**
 * Append one entry to a lead's conversation timeline. Timeline entries are
 * never edited or deleted (except when the whole lead is removed) so the
 * enquiry history stays intact.
 */
export async function addTimelineEntry(input: {
  leadId: string;
  type: TimelineKind;
  body?: string | null;
  audioUrl?: string | null;
  meta?: Record<string, unknown> | null;
  authorId?: string | null;
}) {
  return db.timelineEntry.create({
    data: {
      leadId: input.leadId,
      type: input.type,
      body: input.body ?? null,
      audioUrl: input.audioUrl ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
      authorId: input.authorId ?? null,
    },
  });
}

/** Records a payment update against every lead touched by the payment. */
export async function addPaymentTimeline(
  leadId: string | null | undefined,
  body: string,
  meta?: Record<string, unknown>
) {
  if (!leadId) return;
  await addTimelineEntry({ leadId, type: "PAYMENT", body, meta: meta ?? null });
}
