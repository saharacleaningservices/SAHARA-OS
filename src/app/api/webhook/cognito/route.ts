import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { parseCognitoEntry } from "@/lib/cognito-entry";
import { ingestEnquiry } from "@/server/enquiry-intake";
import { notify } from "@/server/notify";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direct Cognito Forms webhook (2026-10-22): Cognito "Post JSON data to a website" on submit
 *   POST /api/webhook/cognito?key=<COGNITO_WEBHOOK_SECRET>[&form=<label>]
 * Cognito cannot add request headers, so the shared secret travels in the URL (keep it long; rotate it in Coolify and
 * the Cognito form together if it ever leaks). INERT: 404 until COGNITO_WEBHOOK_SECRET (>= 24 characters) is set.
 *
 * Creates or updates the lead through the SAME intake as the email bridge (src/server/enquiry-intake.ts): one open
 * enquiry per mobile / e-mail, call-back follow-up, staff alerts, no customer message. Cognito's entry number is the
 * idempotency key, so a re-sent entry never makes a second lead. An entry without a usable mobile number is not
 * dropped silently: the team gets an alert with the name / e-mail so someone can follow up.
 * Always answers 2xx for a valid, authorised request so Cognito does not keep retrying.
 */
const MAX_BODY_BYTES = 64_000;
const MIN_SECRET = 24;

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: NextRequest) {
  const secret = process.env.COGNITO_WEBHOOK_SECRET ?? "";
  if (secret.length < MIN_SECRET) return new NextResponse(null, { status: 404 });
  if (!safeEqual(req.nextUrl.searchParams.get("key") ?? "", secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit("cognito:all", 120, 60).allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const e = parseCognitoEntry(body, req.nextUrl.searchParams.get("form") ?? "");
  if (!e.mobile) {
    await notify({
      kind: "NEW_INQUIRY",
      title: "⚠️ Cognito enquiry without a mobile number",
      body: [e.name || "No name", e.email, e.service, e.entryRef && `entry ${e.entryRef}`].filter(Boolean).join(" · "),
      href: "/leads",
    }).catch(() => {});
    return NextResponse.json({ ok: false, reason: "no valid mobile number", alerted: true });
  }

  try {
    const res = await ingestEnquiry(
      { mobile: e.mobile, name: e.name, email: e.email, location: e.location, service: e.service, message: e.message },
      { intakeKey: e.entryRef ? `COGNITO:${e.entryRef}` : undefined, defaultSource: "Cognito Form (webhook)" },
    );
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
    return NextResponse.json(res);
  } catch (err) {
    console.error("[cognito-webhook] intake failed:", err);
    return NextResponse.json({ error: "Temporarily unavailable" }, { status: 503 }); // Cognito may retry; the entry key keeps it idempotent
  }
}
