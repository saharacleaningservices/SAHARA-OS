// The first email a new website / Cognito enquiry gets (owner 2026-10-23): a plain acknowledgement and NOTHING else — no quotation,
// no invoice, no price. Sent once per lead, through the CRM's email provider (EMAIL_API_KEY / EMAIL_ENDPOINT / EMAIL_FROM).
// While no provider is configured the message stays QUEUED in the Message Log (never fabricated as sent) and goes out when it is.
// Not a "use server" module: nothing here is callable from the browser.
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export const ENQUIRY_ACK_SUBJECT = "Booking Request Received - Sahara Cleaning Services";
export const ENQUIRY_ACK_BODY =
  "Thank you for contacting Sahara Cleaning Services! We have received your booking request. Our team will review your requirements and get in touch with you shortly to confirm your booking. For urgent queries, call/WhatsApp us at: +91 7083347130 / 8956567130.";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sends (or queues) the acknowledgement for one lead — at most once per lead. Returns what happened, never throws. */
export async function sendEnquiryAck(leadId: string): Promise<{ status: "sent" | "queued" | "skipped"; reason?: string }> {
  try {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true, email: true } });
    const to = lead?.email?.trim();
    if (!lead || !to || !EMAIL_SHAPE.test(to)) return { status: "skipped", reason: "no valid email on the enquiry" };
    const already = await db.emailMessage.findFirst({ where: { relatedType: "Lead", relatedId: lead.id, subject: ENQUIRY_ACK_SUBJECT }, select: { id: true } });
    if (already) return { status: "skipped", reason: "already sent" };
    const r = await sendEmail({ kind: "OTHER", toEmail: to, toName: lead.name, subject: ENQUIRY_ACK_SUBJECT, body: `Dear Customer,\n\n${ENQUIRY_ACK_BODY}\n\nSahara Cleaning Services`, relatedType: "Lead", relatedId: lead.id });
    return { status: r.sent ? "sent" : "queued", ...(r.error ? { reason: r.error } : {}) };
  } catch (e) {
    console.error("[enquiry-ack] failed:", e);
    return { status: "skipped", reason: e instanceof Error ? e.message : "error" };
  }
}
