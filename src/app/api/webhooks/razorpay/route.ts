import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@/lib/webhook-signature";
import { fetchOrder } from "@/server/razorpay";
import { settle } from "@/server/booking-advance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/razorpay — backup for the booking advance when the customer closes the tab right after paying.
 * Auth: Razorpay's X-Razorpay-Signature = HMAC-SHA256(raw body, RAZORPAY_WEBHOOK_SECRET). No secret → 503 (disabled).
 * Subscribe the webhook to `payment.captured` (and `order.paid`). Everything is re-read from Razorpay before it is trusted,
 * and the same payment id is only ever applied once (booking-advance.ts).
 */
const MAX_BYTES = 20_000;

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret || secret.length < 8) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!verifySignature(raw, req.headers.get("x-razorpay-signature"), secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let body: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (body.event !== "payment.captured" && body.event !== "order.paid") return NextResponse.json({ ok: true, ignored: String(body.event ?? "") }, { status: 202 });
  const paymentId = body.payload?.payment?.entity?.id;
  const orderId = body.payload?.payment?.entity?.order_id;
  if (!paymentId || !orderId) return NextResponse.json({ error: "payment and order id required" }, { status: 422 });

  try {
    const order = await fetchOrder(orderId);
    const leadId = order.notes?.leadId;
    if (!leadId || order.notes?.kind !== "booking-advance-20pct") return NextResponse.json({ ok: true, ignored: "not a booking advance" }, { status: 202 });
    const r = await settle(leadId, orderId, paymentId);
    return NextResponse.json(r.ok ? { ok: true, status: r.status } : { ok: false, error: r.error }, { status: r.ok ? 200 : 202 });
  } catch (e) {
    console.error("[razorpay-webhook]", e);
    return NextResponse.json({ error: "Could not process" }, { status: 500 }); // Razorpay retries
  }
}
