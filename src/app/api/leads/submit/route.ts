import { NextRequest, NextResponse } from "next/server";
import { ingestEnquiry } from "@/server/enquiry-intake";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { MAIL_FROM_ADDRESS } from "@/lib/mail-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leads/submit — the native /contact form (replaces the Cognito Forms iframe, owner 2026-11-01).
 * Same intake as the old Cognito webhook (duplicate guard, CRM lead, HIGH call-back follow-up, in-app + WhatsApp alerts), plus the
 * UTM tags, landing page and branch the visitor chose. No login: it is a public form, so it is rate-limited per IP, has a honeypot,
 * validates a 10-digit mobile and stores nothing but what the visitor typed. Reachable on booking.* via the middleware allow-list.
 */
const MAX_BYTES = 8_000;

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`contact-submit:${ip}`, 6, 600);
  if (!rl.allowed) return NextResponse.json({ error: "Too many submissions. Please call or WhatsApp us." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  // Honeypot: real visitors never fill this hidden field. Pretend success so bots learn nothing.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

  const mobile = String(body.mobile ?? "").replace(/\D/g, "").slice(-10);
  const name = String(body.name ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 422 });
  if (!/^[6-9]\d{9}$/.test(mobile)) return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 422 });

  try {
    const res = await ingestEnquiry({ ...body, name, mobile }, { defaultSource: "Website contact form" });
    if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
    const leadId = "created" in res ? res.created : "matchedExisting" in res ? res.matchedExisting : res.duplicate;
    // Management e-mail alert (rebuild 2026-11-02) — background, so the visitor gets the Lead ID with no wait. Only new leads;
    // repeats are already flagged in-app. Goes to the business inbox (LEAD_ALERT_EMAIL, default contact@), never to customers.
    if ("created" in res) {
      const lines = [`New website lead ${leadId}`, `Name: ${name}`, `Mobile: ${mobile}`, `Service: ${String(body.service ?? "").slice(0, 200)}`, `Location: ${String(body.location ?? "").slice(0, 200) || "—"}`, `Details: ${String(body.message ?? "").slice(0, 1000)}`, `Page: ${String(body.landing_page_url ?? "").slice(0, 300)}`];
      void sendEmail({ kind: "OTHER", toEmail: process.env.LEAD_ALERT_EMAIL?.trim() || MAIL_FROM_ADDRESS, toName: "Sahara Management", subject: `New lead ${leadId} — ${name} — ${String(body.service ?? "Website").slice(0, 60)}`, body: lines.join("\n"), relatedType: "LEAD" }).catch((e) => console.error("[contact-submit] lead e-mail failed:", e));
    }
    return NextResponse.json({ ok: true, leadId });
  } catch (e) {
    console.error("[contact-submit] failed:", e);
    return NextResponse.json({ error: "Temporarily unavailable. Please call or WhatsApp us." }, { status: 503 });
  }
}
