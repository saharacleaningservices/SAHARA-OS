import { isIP } from "node:net";
import { NextRequest } from "next/server";
import { publicBookLeadCore } from "@/server/public-booking-core";
import { MAX_BODY_BYTES, IDEMPOTENCY_KEY_PATTERN, apiError, apiJson, bookingErrorResponse, guardPublicApi, withIdempotency } from "@/server/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/v1/leads — booking / enquiry from the marketing website (contract: docs/website/public-api-v1.openapi.yaml).
 * Runs the SAME logic as the booking form's Server Action (publicBookLeadCore); this route only authenticates the website,
 * supplies the real visitor IP for per-visitor throttling, and makes retries idempotent. Inert (404) until the owner sets
 * PUBLIC_API_TOKEN and PUBLIC_API_HMAC_SECRET.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const denied = guardPublicApi(req, raw);
  if (denied) return denied;
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return apiError(413, "Request too large.", "PAYLOAD_TOO_LARGE");

  const key = req.headers.get("idempotency-key") ?? "";
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) return apiError(400, "An Idempotency-Key header (8-80 characters) is required.", "VALIDATION");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return apiError(400, "Body must be valid JSON.", "VALIDATION");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return apiError(400, "Body must be a JSON object.", "VALIDATION");
  const { client, ...form } = parsed as Record<string, unknown>;
  const ip = client && typeof client === "object" ? (client as { ip?: unknown }).ip : undefined;
  if (typeof ip !== "string" || !isIP(ip)) return apiError(400, "client.ip (the visitor's IP address) is required.", "VALIDATION");

  try {
    const out = await withIdempotency(key, raw, async () => {
      const res = await publicBookLeadCore(form, { ip });
      if ("success" in res) {
        // status CONFIRMED = instantly scheduled as a Job (public-auto-confirm.ts); PENDING = request for the office.
        const confirmed = "status" in res && res.status === "CONFIRMED";
        return {
          status: 200,
          body: confirmed
            ? { success: true, leadNumber: res.leadNumber, status: "CONFIRMED", jobNumber: res.jobNumber, bookingUrl: res.bookingUrl }
            : { success: true, leadNumber: res.leadNumber, status: "PENDING" },
        };
      }
      const r = bookingErrorResponse(res);
      return { status: r.status, body: await r.json() };
    });
    if (out.status === 200 || out.status === 422) return apiJson(out.body, out.status, out.replayed ? { "Idempotent-Replayed": "true" } : {});
    const retry = out.status === 429 ? { "Retry-After": "60" } : undefined;
    return apiJson(out.body, out.status, retry);
  } catch (e) {
    console.error("[public-api] lead submission failed:", e);
    return apiError(503, "Temporarily unavailable. Please call or WhatsApp us to book.", "UNAVAILABLE");
  }
}
