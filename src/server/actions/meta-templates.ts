"use server";

import { getSession } from "@/lib/session";
import { getResolvedIntegrations } from "@/server/integrations";
import { templateByName } from "@/lib/whatsapp-cloud-templates";
import { buildMetaTemplatePayload, foreignUrlButtons, PROTECTED_WABA_ID, SUBMITTABLE_TEMPLATES } from "@/lib/meta-template-payload";

type Result = { success: true; message: string; status?: string; category?: string } | { success: false; error: string };

/**
 * Super Admin only. Submits one of the owner-approved Utility templates to Meta for review using the server's own
 * WhatsApp credentials (they never leave the server and are never returned). Refuses the protected WABA, refuses any
 * template outside the allow-list, and never creates a duplicate: a template that already exists is reported, not resubmitted.
 */
export async function submitTemplateToMeta(name: string): Promise<Result> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false, error: "Only the Super Admin can submit templates to Meta." };
  if (!(SUBMITTABLE_TEMPLATES as readonly string[]).includes(name)) return { success: false, error: "That template is not on the approved submission list." };
  const t = templateByName(name);
  if (!t) return { success: false, error: "Template definition not found." };

  const foreign = foreignUrlButtons(t);
  if (foreign.length) return { success: false, error: `Refused: button link ${foreign[0]} is not on the booking domain. Set BOOKING_URL=https://booking.saharacleaningservices.com in Coolify and redeploy.` };
  const { whatsapp } = await getResolvedIntegrations();
  if (!whatsapp.accessToken || !whatsapp.businessId) return { success: false, error: "WhatsApp Business Account ID or access token is not configured." };
  if (whatsapp.businessId === PROTECTED_WABA_ID) return { success: false, error: "Refused: this is the protected WhatsApp Business Account." };
  const base = `https://graph.facebook.com/${whatsapp.apiVersion}`;
  const auth = { Authorization: `Bearer ${whatsapp.accessToken}` };

  const existing = await fetch(`${base}/${whatsapp.businessId}/message_templates?name=${encodeURIComponent(t.name)}&fields=name,status,category`, { headers: auth, cache: "no-store" }).catch(() => null);
  if (!existing) return { success: false, error: "Could not reach Meta." };
  const found = (await existing.json().catch(() => ({}))) as { data?: { name: string; status: string; category: string }[]; error?: { message?: string } };
  if (!existing.ok) return { success: false, error: found.error?.message ?? `Meta error ${existing.status}` };
  const dup = found.data?.find((x) => x.name === t.name);
  if (dup) return { success: false, error: `${t.name} already exists on Meta (${dup.status}, ${dup.category}) — not resubmitted.` };

  // Cloud API wants an uploaded-media handle for an image header sample. It needs the Meta App ID (WHATSAPP_APP_ID);
  // without it the sample is sent as a public URL and Meta's own error, if any, is shown to the admin.
  let headerHandle: string | null = null;
  const appId = process.env.WHATSAPP_APP_ID || process.env.META_APP_ID;
  if (t.header && appId) {
    headerHandle = await uploadHeaderHandle(base, appId, whatsapp.accessToken, t.header.sample).catch(() => null);
    if (!headerHandle) return { success: false, error: "Could not upload the header image sample to Meta." };
  }

  const res = await fetch(`${base}/${whatsapp.businessId}/message_templates`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(buildMetaTemplatePayload(t, { headerHandle })),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { success: false, error: "Could not reach Meta." };
  const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; category?: string; error?: { message?: string; error_user_msg?: string } };
  if (!res.ok) return { success: false, error: json.error?.error_user_msg || json.error?.message || `Meta error ${res.status}` };
  return { success: true, message: `${t.name} submitted for review.`, status: json.status, category: json.category };
}

/** Super Admin only: current review status of the three templates on Meta (read-only). */
export async function getTemplateSubmissionStatus(): Promise<{ success: true; rows: { name: string; status: string; category: string | null }[] } | { success: false; error: string }> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { success: false, error: "Only the Super Admin can view this." };
  const { whatsapp } = await getResolvedIntegrations();
  if (!whatsapp.accessToken || !whatsapp.businessId) return { success: false, error: "WhatsApp Business Account ID or access token is not configured." };
  if (whatsapp.businessId === PROTECTED_WABA_ID) return { success: false, error: "Refused: this is the protected WhatsApp Business Account." };
  const res = await fetch(`https://graph.facebook.com/${whatsapp.apiVersion}/${whatsapp.businessId}/message_templates?fields=name,status,category&limit=200`, { headers: { Authorization: `Bearer ${whatsapp.accessToken}` }, cache: "no-store" }).catch(() => null);
  if (!res) return { success: false, error: "Could not reach Meta." };
  const json = (await res.json().catch(() => ({}))) as { data?: { name: string; status: string; category: string }[]; error?: { message?: string } };
  if (!res.ok) return { success: false, error: json.error?.message ?? `Meta error ${res.status}` };
  return { success: true, rows: SUBMITTABLE_TEMPLATES.map((name) => { const m = json.data?.find((x) => x.name === name); return { name, status: m?.status ?? "NOT SUBMITTED", category: m?.category ?? null }; }) };
}

/** Meta Resumable Upload: fetch the public sample image, upload it to the app, return the handle used as header_handle. */
async function uploadHeaderHandle(base: string, appId: string, token: string, imageUrl: string): Promise<string | null> {
  const img = await fetch(imageUrl, { cache: "no-store" });
  if (!img.ok) return null;
  const bytes = Buffer.from(await img.arrayBuffer());
  const type = img.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const start = await fetch(`${base}/${appId}/uploads?file_length=${bytes.length}&file_type=${encodeURIComponent(type)}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const session = (await start.json().catch(() => ({}))) as { id?: string };
  if (!start.ok || !session.id) return null;
  const up = await fetch(`${base}/${session.id}`, { method: "POST", headers: { Authorization: `OAuth ${token}`, file_offset: "0", "Content-Type": type }, body: bytes });
  const done = (await up.json().catch(() => ({}))) as { h?: string };
  return up.ok && done.h ? done.h : null;
}
