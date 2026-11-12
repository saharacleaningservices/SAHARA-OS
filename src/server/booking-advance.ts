// DORMANT since owner 2026-11-12 ("100% Pay After Service", ADVANCE_PERCENT = 0): startAdvance() now refuses. Kept for reference. Former order of events:
//   1. the booking flow saves the booking as a HELD request (publicBookLead holdForAdvance → no auto-confirm yet);
//   2. startAdvance() creates a Razorpay order for 20% of the SERVER-priced quote (the browser never sets the amount);
//   3. after payment, finalizeAdvance() (checkout success) or the webhook calls applyVerifiedAdvance(), which records a
//      Payment row on the lead (the confirm core later attaches it to the Job), marks the advance on the lead and only
//      THEN auto-confirms the slot into a Job. Idempotent: the same payment id is applied once.

import { db } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/id-generators";
import { rateLimit } from "@/lib/rate-limit";
import { paymentSplit } from "@/lib/booking-payment";
import { last10 } from "@/lib/phone";
import { withSlotLock } from "@/lib/slot-lock";
import { addTimelineEntry } from "@/server/timeline";
import { notify } from "@/server/notify";
import { autoConfirmWebBooking } from "@/server/public-auto-confirm";
import { advanceEnabled, capturePayment, createOrder, fetchOrder, fetchPayment, razorpayKeys, verifyCheckoutSignature } from "@/server/razorpay";

const OPEN = ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"] as const;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export type AdvanceStart = { ok: true; orderId: string; amountPaise: number; keyId: string; advance: number; total: number; balance: number; leadNumber: string; name: string } | { ok: false; error: string };
export type AdvanceResult = { ok: true; status: "CONFIRMED" | "PENDING"; leadNumber: string; jobNumber: string; advance: number; total: number; bookingUrl: string | null } | { ok: false; error: string };

export async function startAdvance(input: { leadId: string; mobile: string }): Promise<AdvanceStart> {
  const keys = razorpayKeys();
  if (!advanceEnabled() || !keys) return { ok: false, error: "Online advance is not available right now — please call us to confirm your booking." };
  if (!rateLimit(`adv:start:${input.leadId}`, 8, 600).allowed) return { ok: false, error: "Too many attempts — please wait a few minutes." };
  const lead = await db.lead.findFirst({ where: { id: input.leadId, deletedAt: null } });
  if (!lead || last10(lead.mobile) !== last10(input.mobile)) return { ok: false, error: "We could not find this booking." };
  if (!(OPEN as readonly string[]).includes(lead.stage)) return { ok: false, error: "This booking is already confirmed." };
  if ((lead.advanceAmount ?? 0) > 0) return { ok: false, error: "The advance for this booking is already paid." };
  const total = lead.quoteAmount ?? 0;
  if (total <= 0) return { ok: false, error: "This booking has no online price — our team will confirm it." };
  const split = paymentSplit(total);
  const amountPaise = Math.round(split.advance * 100);
  if (amountPaise < 100) return { ok: false, error: "Advance amount is too small." };
  try {
    const order = await createOrder({ amountPaise, receipt: lead.leadNumber, notes: { leadId: lead.id, leadNumber: lead.leadNumber, kind: "booking-advance-20pct" } });
    return { ok: true, orderId: order.id, amountPaise, keyId: keys.id, advance: split.advance, total: split.total, balance: split.balance, leadNumber: lead.leadNumber, name: lead.name };
  } catch (e) {
    console.error("[booking-advance] order failed:", e);
    return { ok: false, error: "Payment could not be started — please try again or call us." };
  }
}

/** Customer returned from Razorpay Checkout: verify the signature, confirm the money with Razorpay, then apply it. */
export async function finalizeAdvance(input: { leadId: string; orderId: string; paymentId: string; signature: string }): Promise<AdvanceResult> {
  const keys = razorpayKeys();
  if (!keys) return { ok: false, error: "Payment is not configured." };
  if (!verifyCheckoutSignature(input.orderId, input.paymentId, input.signature, keys.secret)) return { ok: false, error: "Payment could not be verified. If money was deducted, it will be refunded or applied automatically — please call us." };
  return settle(input.leadId, input.orderId, input.paymentId);
}

/** Shared by checkout success and the webhook: trust only what Razorpay itself reports for this order / payment. */
export async function settle(leadId: string, orderId: string, paymentId: string): Promise<AdvanceResult> {
  try {
    const order = await fetchOrder(orderId);
    if (order.notes?.leadId !== leadId) return { ok: false, error: "This payment does not belong to this booking." };
    let pay = await fetchPayment(paymentId);
    if (pay.order_id !== orderId) return { ok: false, error: "This payment does not belong to this booking." };
    if (pay.status === "authorized") pay = await capturePayment(paymentId, order.amount);
    if (pay.status !== "captured" || pay.amount < order.amount) return { ok: false, error: "Payment is not completed yet." };
    return await applyVerifiedAdvance({ leadId, orderId, paymentId, amountRupees: pay.amount / 100 });
  } catch (e) {
    console.error("[booking-advance] settle failed:", e);
    return { ok: false, error: "We could not confirm the payment yet — please call us; your money is safe." };
  }
}

export async function applyVerifiedAdvance(input: { leadId: string; orderId: string; paymentId: string; amountRupees: number }): Promise<AdvanceResult> {
  return withSlotLock(`adv:${input.paymentId}`, async () => {
    const lead = await db.lead.findFirst({ where: { id: input.leadId, deletedAt: null } });
    if (!lead) return { ok: false as const, error: "Booking not found." };
    const total = lead.quoteAmount ?? 0;
    const already = await db.payment.findFirst({ where: { leadId: lead.id, notes: { contains: input.paymentId } }, select: { id: true } });
    if (!already) {
      await db.payment.create({
        data: {
          invoiceNumber: await generateInvoiceNumber(),
          leadId: lead.id,
          clientName: lead.name,
          clientMobile: lead.mobile,
          amount: total,
          paidAmount: input.amountRupees,
          dueDate: lead.serviceDate ?? new Date(),
          paidDate: new Date(),
          status: "PENDING", // the balance is still due; the confirm core re-derives PAID from paidAmount
          mode: "ONLINE",
          notes: `Online 20% advance (Razorpay) · payment ${input.paymentId} · order ${input.orderId}`,
        },
      });
      await db.lead.update({ where: { id: lead.id }, data: { advanceAmount: input.amountRupees, paymentMode: "ONLINE", paymentStatus: "PARTIAL", paymentPreference: "PAY_ADVANCE" } });
      await addTimelineEntry({ leadId: lead.id, type: "SYSTEM", body: `💳 Advance ${inr(input.amountRupees)} (20%) received online via Razorpay (${input.paymentId}) — balance ${inr(Math.max(0, total - input.amountRupees))} payable after service.` }).catch(() => {});
    }
    let jobNumber = "";
    let bookingUrl: string | null = null;
    let confirmed = lead.stage === "JOB_SCHEDULED";
    if (!confirmed) {
      const fresh = await db.lead.findUnique({ where: { id: lead.id } });
      const auto = await autoConfirmWebBooking(lead.id, {
        serviceDate: fresh?.serviceDate ? fresh.serviceDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : null,
        timeSlot: fresh?.timeSlot ?? null,
        serviceCategory: fresh?.serviceCategory ?? null,
        inspectionRequired: false,
      });
      if (auto.confirmed) { confirmed = true; jobNumber = auto.jobNumber; bookingUrl = auto.bookingUrl; }
    }
    if (confirmed && !jobNumber) {
      jobNumber = (await db.job.findFirst({ where: { leadId: lead.id, deletedAt: null }, select: { jobNumber: true }, orderBy: { createdAt: "desc" } }))?.jobNumber ?? "";
    }
    if (!already) {
      await notify({
        kind: "NEW_BOOKING",
        title: `Advance ${inr(input.amountRupees)} received — ${lead.name}${confirmed ? ` · ${jobNumber || "confirmed"} — assign crew` : " · confirm the slot"}`,
        body: `${lead.leadNumber} · ☎ ${lead.mobile}`,
        href: `/leads/${lead.id}`,
        whatsappToAdmin: true,
        meta: { leadId: lead.id, leadNumber: lead.leadNumber },
      }).catch(() => {});
    }
    return { ok: true as const, status: confirmed ? ("CONFIRMED" as const) : ("PENDING" as const), leadNumber: lead.leadNumber, jobNumber, advance: input.amountRupees, total, bookingUrl };
  });
}
