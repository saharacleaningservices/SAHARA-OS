"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendWhatsApp } from "@/lib/whatsapp";
import { sendSMS } from "@/lib/sms";
import {
  bookingFormMessage,
  followUpNudgeMessage,
  reviewRequestMessage,
  galleryShareMessage,
  paymentOptionsMessage,
} from "@/lib/whatsapp-templates";
import { getCompanySettings } from "@/server/settings";
import { addTimelineEntry } from "@/server/timeline";
import { toWhatsAppLink } from "@/lib/utils";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

const BASE = PUBLIC_BOOKING_URL;

type Kind = "BOOKING_FORM" | "FOLLOWUP" | "REVIEW" | "PAYMENT" | "GALLERY";

// Only the unguessable token goes in the URL — the page looks up the customer's
// name/mobile from the BookingLink row. Personal data in a URL would leak to
// analytics tags (Meta Pixel / GA4 page views), browser history and referrers.
function bookUrl(token: string) {
  return `${BASE}/book?${new URLSearchParams({ bl: token }).toString()}`;
}

/**
 * Create a personalized link for a customer and return a wa.me URL the CRM
 * opens in a new tab. Also queues a WhatsApp message row so it goes out
 * automatically once the Cloud API is connected. For BOOKING_FORM / FOLLOWUP
 * an open 24h follow-up is scheduled on the linked lead.
 */
export async function createBookingLink(input: {
  kind?: Kind;
  name: string;
  mobile: string;
  leadId?: string;
  jobId?: string;
}) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const mobile = (input.mobile || "").replace(/[^\d]/g, "").slice(-10);
  if (mobile.length !== 10) return { error: "Customer needs a valid 10-digit mobile number" };
  const name = (input.name || "Customer").trim().slice(0, 80);
  const kind: Kind = input.kind ?? "BOOKING_FORM";

  const token = randomBytes(9).toString("hex");
  const link = await db.bookingLink.create({
    data: {
      token,
      kind,
      customerName: name,
      customerMobile: mobile,
      leadId: input.leadId ?? null,
      jobId: input.jobId ?? null,
      createdByName: session.name,
    },
  });

  const settings = await getCompanySettings();
  let text: string;
  if (kind === "REVIEW") {
    text = reviewRequestMessage({
      customerName: name,
      service: "cleaning service",
      googleReviewUrl: settings.googleReviewUrl ?? null,
      jobNumber: "",
    });
  } else if (kind === "FOLLOWUP") {
    text = followUpNudgeMessage({ customerName: name, url: bookUrl(token) });
  } else if (kind === "GALLERY") {
    text = galleryShareMessage({ customerName: name });
  } else if (kind === "PAYMENT") {
    text = paymentOptionsMessage({
      customerName: name,
      upiId: settings.upiId ?? null,
      upiQrUrl: settings.upiQrUrl ?? null,
      bankName: settings.bankName ?? null,
      bankAccountName: settings.bankAccountName ?? null,
      bankAccountNumber: settings.bankAccountNumber ?? null,
      bankIfsc: settings.bankIfsc ?? null,
    });
  } else {
    text = bookingFormMessage({ customerName: name, url: bookUrl(token) });
  }

  // Queue for the Cloud API + SMS fallback (both go out when connected) and
  // return an instant click-to-chat URL for the staff member's own WhatsApp.
  await sendWhatsApp({
    kind: kind === "REVIEW" ? "REVIEW_REQUEST" : "OTHER",
    toNumber: mobile,
    toName: name,
    body: text,
    relatedType: "BookingLink",
    relatedId: link.id,
  }).catch(() => {});
  await sendSMS({
    kind: kind === "REVIEW" ? "REVIEW" : "OTHER",
    toNumber: mobile,
    toName: name,
    body: text,
    relatedType: "BookingLink",
    relatedId: link.id,
  }).catch(() => {});

  if (input.leadId) {
    const label =
      kind === "REVIEW"
        ? "Review request sent"
        : kind === "FOLLOWUP"
          ? "Follow-up sent"
          : kind === "PAYMENT"
            ? "Payment options sent"
            : kind === "GALLERY"
              ? "Before/After gallery sent"
              : "Booking Form Sent";
    await addTimelineEntry({
      leadId: input.leadId,
      type: "SYSTEM",
      body: `${label} to ${name} (${mobile}) by ${session.name}`,
    }).catch(() => {});
  }

  // 24h follow-up so a sent form is never forgotten.
  if ((kind === "BOOKING_FORM" || kind === "FOLLOWUP") && input.leadId) {
    await db.followUp
      .create({
        data: {
          leadId: input.leadId,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          type: "WHATSAPP",
          priority: "MEDIUM",
          notes: `Booking form sent to ${name} — follow up if not submitted.`,
        },
      })
      .catch(() => {});
    await db.bookingLink.update({ where: { id: link.id }, data: { followUpMade: true } }).catch(() => {});
  }

  revalidatePath("/leads");
  revalidatePath("/customers");
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);

  return {
    success: true as const,
    waUrl: toWhatsAppLink(mobile, text),
    link: bookUrl(token),
    token,
  };
}

/** Bulk — one link per customer; returns the list so the CRM can open each. */
export async function bulkCreateBookingLinks(
  kind: Kind,
  customers: { name: string; mobile: string; leadId?: string }[],
) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const results: { name: string; mobile: string; waUrl: string }[] = [];
  for (const c of customers.slice(0, 100)) {
    const r = await createBookingLink({ kind, name: c.name, mobile: c.mobile, leadId: c.leadId });
    if ("waUrl" in r && r.waUrl) results.push({ name: c.name, mobile: c.mobile, waUrl: r.waUrl });
  }
  return { success: true as const, count: results.length, results };
}
