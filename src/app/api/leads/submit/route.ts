import { NextRequest, NextResponse } from "next/server";
import { ingestEnquiry } from "@/server/enquiry-intake";
import { rateLimit } from "@/lib/rate-limit";

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
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact-submit] failed:", e);
    return NextResponse.json({ error: "Temporarily unavailable. Please call or WhatsApp us." }, { status: 503 });
  }
}
