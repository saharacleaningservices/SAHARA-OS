import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { CALL_CLICK_HEADER, CALL_CLICK_MOBILE, CALL_FOLLOWUP_MINUTES, callClickNote, callClickSource, touchForCall, type CallClickInput } from "@/lib/call-click";

const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Logs one tap on a website tel: link as a CRM lead (owner 2026-11-13). One lead per visitor per IST day: the visitor is a
 * salted hash of IP + browser (the raw IP is never stored); further taps the same day only add a timeline note. The caller's
 * number is unknown, so the lead carries a placeholder mobile and a HIGH call follow-up due in 15 minutes.
 */
export async function recordCallClick(input: CallClickInput, visitor: { ip: string; ua: string }, now: Date = new Date()): Promise<{ leadId: string; created: boolean }> {
  const touch = touchForCall(input.attribution);
  const src = callClickSource(touch);
  const note = callClickNote(input, src, now);
  const visitorKey = createHash("sha256").update(`${process.env.AUTH_SECRET ?? "sahara"}|${visitor.ip}|${visitor.ua}`).digest("hex").slice(0, 16);
  const intakeKey = `CC:${istDay(now)}:${visitorKey}`;

  const existing = await db.lead.findUnique({ where: { intakeKey }, select: { id: true } });
  if (existing) {
    await addTimelineEntry({ leadId: existing.id, type: "CALL", body: note, meta: { source: "call-click", line: input.line } }).catch(() => {});
    return { leadId: existing.id, created: false };
  }

  const leadNumber = await generateLeadNumber();
  const lead = await db.lead
    .create({
      data: {
        leadNumber,
        name: `${CALL_CLICK_HEADER} Website call tap`,
        mobile: CALL_CLICK_MOBILE,
        area: "—",
        service: "HOME_DEEP_CLEANING" as never,
        source: "WEBSITE" as never,
        stage: "NEW",
        intakeKey,
        receivedOnNumber: input.line,
        ...(src.sourceTag ? { sourceTag: src.sourceTag } : {}),
        acquisitionChannel: src.channel,
        firstTouchSource: src.channel,
        firstTouchAt: now,
        latestTouchSource: src.channel,
        latestTouchAt: now,
        utmSource: touch?.source ?? null,
        utmMedium: touch?.medium ?? null,
        utmCampaign: touch?.campaign ?? null,
        utmTerm: touch?.term ?? null,
        utmContent: touch?.content ?? null,
        gclid: touch?.gclid ?? null,
        fbclid: touch?.fbclid ?? null,
        landingPage: input.page || touch?.landingPage || null,
        landingPageUrl: touch?.landingPageUrl ?? null,
        notes: note,
      },
      select: { id: true },
    })
    .catch(async (e: { code?: string }) => {
      // Two taps racing for the same visitor/day: the unique intakeKey rejects the second; fall back to the winner.
      if (e?.code === "P2002") return db.lead.findUnique({ where: { intakeKey }, select: { id: true } });
      throw e;
    });
  if (!lead) throw new Error("call-click lead not created");
  await db.followUp
    .create({ data: { leadId: lead.id, dueDate: new Date(now.getTime() + CALL_FOLLOWUP_MINUTES * 60_000), type: "CALL", priority: "HIGH", notes: `${CALL_CLICK_HEADER} Visitor tapped call — if they did not reach us, find the number and call back` } })
    .catch(() => {});
  await addTimelineEntry({ leadId: lead.id, type: "SYSTEM", body: note, meta: { source: "call-click", line: input.line } }).catch(() => {});
  return { leadId: lead.id, created: true };
}

/**
 * Leads still NEW after CALL_FOLLOWUP_MINUTES with nobody having logged a call (a staff-authored CALL timeline entry or a finished
 * CALL follow-up) — the admin dashboard's "Pending Follow-up" list. Last 7 days only, oldest first.
 */
export async function getPendingFollowUps(now: Date = new Date(), take = 15) {
  const cutoff = new Date(now.getTime() - CALL_FOLLOWUP_MINUTES * 60_000);
  const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const where = {
    deletedAt: null,
    stage: "NEW" as const,
    createdAt: { lte: cutoff, gte: since },
    timeline: { none: { type: "CALL" as const, authorId: { not: null } } },
    followUps: { none: { type: "CALL" as const, isDone: true } },
  };
  const [rows, total] = await Promise.all([
    db.lead.findMany({ where: where as never, orderBy: { createdAt: "asc" }, take, select: { id: true, leadNumber: true, name: true, service: true, area: true, mobile: true, createdAt: true, acquisitionChannel: true, sourceTag: true, notes: true } }),
    db.lead.count({ where: where as never }),
  ]);
  return { rows, total };
}
