import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callWebhookAuthorised } from "@/lib/call-webhook-auth";
import { callMetaFrom, callerFrom, formatTalkTime, recordingUploadsOpen } from "@/lib/call-autoresponder";
import { isProtectedNumber } from "@/lib/protected-numbers";
import { uploadsRoot } from "@/lib/uploads";
import { addTimelineEntry } from "@/server/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/webhooks/call-recording — call audio from the Sahara OS Helper app (owner 2026-10-26).
 *
 * multipart/form-data: file (audio), caller (10-digit mobile), externalId (de-duplication id), durationSec, endedAt, deviceLabel.
 * Pre-check: the same fields with check=1 and NO file reply { wantsUpload } so the app sends audio only when it will be kept.
 * Auth: "Authorization: Bearer <CALL_TRIGGER_TOKEN>" (same secret as /call-trigger).
 *
 * Privacy rules: the recording is stored ONLY when the caller already has a lead (nothing unattached is kept), never for owner / internal
 * numbers, and it is played back to office roles only (/uploads/call-recordings is a private folder). Uploads stop for good after
 * CALL_RECORDING_UPLOADS_UNTIL (YYYY-MM-DD, IST) — the app has its own 1-month switch too.
 *
 * Replies are always JSON; every "not stored" outcome is a 2xx with a reason so the app marks the file done and never retries it.
 */
const MAX_BYTES = 30 * 1024 * 1024;
const EXT: Record<string, string> = { m4a: "m4a", mp4: "m4a", mp3: "mp3", aac: "aac", amr: "amr", "3gp": "3gp", wav: "wav", ogg: "ogg", opus: "ogg" };

function extOf(file: File): string | null {
  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (EXT[fromName]) return EXT[fromName];
  const t = file.type.toLowerCase();
  if (t === "audio/mp4" || t === "audio/x-m4a" || t === "audio/m4a") return "m4a";
  if (t === "audio/mpeg") return "mp3";
  if (t === "audio/aac") return "aac";
  if (t === "audio/amr") return "amr";
  if (t === "audio/3gpp") return "3gp";
  if (t === "audio/wav" || t === "audio/x-wav") return "wav";
  if (t === "audio/ogg") return "ogg";
  return null;
}

export async function POST(req: NextRequest) {
  if (!callWebhookAuthorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!recordingUploadsOpen(process.env.CALL_RECORDING_UPLOADS_UNTIL)) return NextResponse.json({ error: "recording_uploads_closed" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }
  const fields = Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  const check = fields.check === "1";
  const file = form.get("file");
  if (!check) {
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No audio file" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 30 MB)" }, { status: 413 });
    if (!extOf(file)) return NextResponse.json({ error: "Unsupported audio type" }, { status: 415 });
  }
  const caller = callerFrom(fields);
  if (!caller) return NextResponse.json({ error: "No valid Indian mobile caller number" }, { status: 400 });
  const answer = (stored: boolean, reason: string, status = 200) => NextResponse.json(check ? { ok: true, wantsUpload: false, reason } : { ok: true, stored, reason }, { status });
  if (isProtectedNumber(caller)) return answer(false, "internal_number");

  const meta = callMetaFrom(fields);
  const lead = await db.lead.findFirst({ where: { mobile: caller, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, leadNumber: true } });
  if (!lead) return answer(false, "no_lead", 202);

  if (meta.externalId) {
    const dupe = await db.timelineEntry.findFirst({
      where: { leadId: lead.id, type: "CALL", audioUrl: { not: null }, meta: { contains: `"recordingFor":"${meta.externalId}"` } },
      select: { id: true },
    });
    if (dupe) return answer(false, "duplicate");
  }
  if (check) return NextResponse.json({ ok: true, wantsUpload: true, lead: lead.leadNumber });
  const ext = extOf(file as File)!;

  const dir = path.join(uploadsRoot(), "call-recordings");
  await mkdir(dir, { recursive: true });
  const name = `${randomBytes(12).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await (file as File).arrayBuffer()));

  const dur = Number(fields.durationSec ?? fields.duration ?? "NaN");
  const talk = Number.isFinite(dur) && dur > 0 ? ` · ${formatTalkTime(Math.round(dur))}` : "";
  await addTimelineEntry({
    leadId: lead.id,
    type: "CALL",
    body: `Call recording${talk}${meta.deviceLabel ? ` · ${meta.deviceLabel}` : ""}`,
    audioUrl: `/uploads/call-recordings/${name}`,
    meta: { recordingFor: meta.externalId, durationSec: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null, source: "helper-app" },
  });
  return NextResponse.json({ ok: true, stored: true, lead: lead.leadNumber });
}
