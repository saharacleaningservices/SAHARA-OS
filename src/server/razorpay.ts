// Razorpay (UPI / cards / netbanking) for the 20% booking advance (owner 2026-11-12). Plain REST — no SDK dependency.
// Keys are never in the repo: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (and RAZORPAY_WEBHOOK_SECRET for the backup
// webhook) in Coolify. Until both keys exist the advance step is OFF and bookings work exactly as before.
//   BOOKING_ADVANCE_ENABLED=off   kill switch while keys are set

import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

export function razorpayKeys(): { id: string; secret: string } | null {
  const id = process.env.RAZORPAY_KEY_ID?.trim();
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  return id && secret ? { id, secret } : null;
}

/** Whether the website asks for the 20% online advance. */
// Advance payment is strictly OPT-IN (owner 2026-11-12: no mandatory advance): it needs BOOKING_ADVANCE_ENABLED=on AND Razorpay keys.
export const advanceEnabled = () => (process.env.BOOKING_ADVANCE_ENABLED ?? "").toLowerCase() === "on" && razorpayKeys() !== null;

export type RzpOrder = { id: string; amount: number; amount_paid: number; status: string; notes?: Record<string, string> };
export type RzpPayment = { id: string; order_id: string; amount: number; status: string; captured?: boolean };

async function call<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const keys = razorpayKeys();
  if (!keys) throw new Error("Razorpay is not configured");
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Basic ${Buffer.from(`${keys.id}:${keys.secret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Razorpay ${path} → HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return (await res.json()) as T;
}

export const createOrder = (input: { amountPaise: number; receipt: string; notes: Record<string, string> }) =>
  call<RzpOrder>("/orders", { method: "POST", body: { amount: input.amountPaise, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes } });
export const fetchOrder = (orderId: string) => call<RzpOrder>(`/orders/${encodeURIComponent(orderId)}`);
export const fetchPayment = (paymentId: string) => call<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}`);
export const capturePayment = (paymentId: string, amountPaise: number) => call<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, { method: "POST", body: { amount: amountPaise, currency: "INR" } });

/** Checkout success signature: HMAC-SHA256(`<order_id>|<payment_id>`, key secret). Constant-time. Pure — unit-tested. */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return timingSafeEqual(Buffer.from(signature.toLowerCase(), "hex"), Buffer.from(expected, "hex"));
}
