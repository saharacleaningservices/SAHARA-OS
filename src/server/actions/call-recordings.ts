"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canAccessAudioAudit } from "@/lib/permissions";
import { addTimelineEntry } from "@/server/timeline";

const URL_RE = /^\/uploads\/call-recordings\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Super Admin only: attach an uploaded call recording (already stored via /api/upload) to a lead. */
export async function addCallRecording(leadId: string, audioUrl: string, durationSec?: number | null) {
  const session = await getSession();
  if (!session || !canAccessAudioAudit(session.role)) return { error: "Not authorized", success: false as const };
  if (!URL_RE.test(audioUrl)) return { error: "Invalid recording", success: false as const };
  const lead = await db.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
  if (!lead) return { error: "Lead not found", success: false as const };
  const duration = durationSec && Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec) : null;
  await db.callRecording.create({ data: { leadId, audioUrl, duration, uploadedBy: session.sub } });
  await addTimelineEntry({ leadId, type: "NOTE", body: "Call recording added (Admin audit)", authorId: session.sub });
  revalidatePath(`/leads/${leadId}`);
  return { success: true as const };
}

/** Super Admin only: list recordings for a lead (new table + legacy Helper-app timeline audio). */
export async function listCallRecordings(leadId: string) {
  const session = await getSession();
  if (!session || !canAccessAudioAudit(session.role)) return [];
  return loadRecordingsForAdmin(leadId);
}

export async function loadRecordingsForAdmin(leadId: string) {
  const [rows, legacy] = await Promise.all([
    db.callRecording.findMany({ where: { leadId }, orderBy: { recordedAt: "desc" }, take: 100 }),
    db.timelineEntry.findMany({ where: { leadId, type: "CALL", audioUrl: { not: null } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, audioUrl: true, createdAt: true, meta: true } }),
  ]);
  const seen = new Set(rows.map((r) => r.audioUrl));
  const items = rows.map((r) => ({ id: r.id, audioUrl: r.audioUrl, duration: r.duration, recordedAt: r.recordedAt }));
  for (const t of legacy) {
    if (!t.audioUrl || seen.has(t.audioUrl)) continue;
    let dur: number | null = null;
    try { dur = (JSON.parse(t.meta ?? "{}") as { durationSec?: number | null }).durationSec ?? null; } catch { /* ignore */ }
    items.push({ id: `t-${t.id}`, audioUrl: t.audioUrl, duration: dur, recordedAt: t.createdAt });
  }
  return items.sort((a, b) => +b.recordedAt - +a.recordedAt);
}
