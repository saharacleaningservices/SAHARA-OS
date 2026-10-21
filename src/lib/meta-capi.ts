// Meta Conversions API (server-side events). Pure builders + one network call.
// Sent only after a customer submits a public form themselves; phone/email are SHA-256 hashed
// (Meta's normalisation rules) and never logged. Needs NEXT_PUBLIC_META_PIXEL_ID + META_CAPI_TOKEN
// (server-only secret, entered by the owner in Coolify). No-op while either is unset.
import { createHash } from "node:crypto";
import { isProtectedNumber } from "@/lib/protected-numbers";

export const CAPI_EVENTS = ["Lead", "Schedule"] as const;
export type CapiEventName = (typeof CAPI_EVENTS)[number];

const GRAPH_VERSION = "v21.0";

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

/** Indian mobile → 91XXXXXXXXXX digits (Meta wants country code, digits only), or undefined if not a valid number. */
export function normalizePhone(raw?: string | null): string | undefined {
  const d = (raw ?? "").replace(/\D/g, "");
  const ten = d.length >= 10 ? d.slice(-10) : "";
  return /^[6-9]\d{9}$/.test(ten) ? `91${ten}` : undefined;
}

export function normalizeEmail(raw?: string | null): string | undefined {
  const e = (raw ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : undefined;
}

export type CapiInput = {
  eventName: CapiEventName;
  eventId: string;
  sourceUrl: string;
  mobile?: string | null;
  email?: string | null;
  fbp?: string;
  fbc?: string;
  ip?: string;
  userAgent?: string;
  category?: string;
  variant?: string;
  /** Order value in INR (the booking total), sent as custom_data.value so Meta can optimise on revenue. */
  value?: number;
  now?: number; // ms, for tests
};

export function buildCapiPayload(i: CapiInput, testEventCode?: string) {
  const ph = normalizePhone(i.mobile);
  const em = normalizeEmail(i.email);
  const user_data: Record<string, unknown> = {
    ...(ph ? { ph: [sha256(ph)] } : {}),
    ...(em ? { em: [sha256(em)] } : {}),
    ...(i.fbp ? { fbp: i.fbp } : {}),
    ...(i.fbc ? { fbc: i.fbc } : {}),
    ...(i.ip && i.ip !== "unknown" ? { client_ip_address: i.ip } : {}),
    ...(i.userAgent ? { client_user_agent: i.userAgent } : {}),
  };
  return {
    data: [
      {
        event_name: i.eventName,
        event_time: Math.floor((i.now ?? Date.now()) / 1000),
        event_id: i.eventId, // same id as the browser Pixel event → Meta de-duplicates
        action_source: "website",
        event_source_url: i.sourceUrl,
        user_data,
        custom_data: { content_name: i.variant, content_category: i.category, ...(i.value && i.value > 0 ? { value: i.value, currency: "INR" } : {}) },
      },
    ],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };
}

/** Best-effort send. Never throws; returns what happened so the route can answer without leaking details. */
export async function sendCapiEvent(i: CapiInput): Promise<{ sent: boolean; reason?: string }> {
  if (isProtectedNumber(i.mobile)) return { sent: false, reason: "protected" };
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return { sent: false, reason: "not-configured" };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixel}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(buildCapiPayload(i, process.env.META_CAPI_TEST_CODE || undefined)),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? { sent: true } : { sent: false, reason: `meta-${res.status}` };
  } catch {
    return { sent: false, reason: "network" };
  }
}
