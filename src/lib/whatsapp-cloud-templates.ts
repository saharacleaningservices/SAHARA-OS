// WhatsApp Cloud API message templates for the +91 9175220270 sender.
//
// PREPARED, not submitted: each must be created and approved in WhatsApp
// Manager → Message templates with exactly this name, category, language,
// body and buttons before it can be sent. Meta rejects a send whose template
// isn't approved, and that rejection is logged on the Message Log.
//
// Buttons follow Meta's current template limits: up to 10 buttons, at most
// 2 URL buttons, quick replies allowed alongside. A URL button's dynamic part
// is a single {{1}} at the END of the URL.
//
// Category: UTILITY = about an enquiry, booking, job or payment the customer
// already has; MARKETING = promotional / re-engagement. Meta may
// re-categorise on review — its decision wins.

import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { FIXED_PROFILES } from "@/lib/social-links";

export type TemplateButton =
  | { type: "URL"; text: string; url: string; example?: string }
  | { type: "QUICK_REPLY"; text: string }
  | { type: "PHONE_NUMBER"; text: string; phone: string };

export type CloudTemplate = {
  key: string;
  name: string;
  category: "UTILITY" | "MARKETING";
  language: "en";
  purpose: string;
  /** Optional media header; the sample is what Meta's reviewer sees (the real image URL is passed per send). */
  header?: { type: "IMAGE"; sample: string };
  body: string;
  /** Optional footer line shown under the body (plain text, ≤60 characters). */
  footer?: string;
  /** Example value per {{n}} body placeholder, in order (Meta requires examples). */
  examples: string[];
  buttons?: TemplateButton[];
};

const BOOKING_PAGE = `${PUBLIC_BOOKING_URL}/booking/`;
export const BOOKING_HEADER_IMAGE = `${PUBLIC_BOOKING_URL}/marketing/booking-header.jpg`;
const profileUrl = (key: "facebook" | "instagram" | "youtube") => FIXED_PROFILES.find((p) => p.key === key)!.url;
const EX_TOKEN = "q7Xk2mPz9LwR4tNc8vB1yH6s";
/** Sahara's Google review link — static URL button of sahara_review_request_v2. */
export const GOOGLE_REVIEW_URL = "https://g.page/r/CYJ9szEiGaN4EBE/review";

export const CLOUD_TEMPLATES: CloudTemplate[] = [
  {
    key: "QA",
    name: "sahara_test_booking",
    category: "MARKETING",
    language: "en",
    purpose: "Controlled QA test (first message after go-live)",
    body:
      "Hello {{1}}, this is Sahara Cleaning Services.\nWe are testing our WhatsApp booking communication system.\nFor any cleaning service enquiry or booking, please contact us.\nThank you.",
    examples: ["SAHARA QA TEST"],
  },
  {
    key: "1",
    name: "sahara_booking_request_received",
    category: "UTILITY",
    language: "en",
    purpose: "Booking request received (NOT a confirmation)",
    body:
      "Hi {{1}}, we have received your booking request {{2}} for {{3}} on {{4}} ({{5}}).\nOur team will confirm the slot shortly. This is not yet a confirmed booking.\n— Sahara Cleaning Services",
    examples: ["Priya", "LD-2026-0130", "Home Deep Cleaning", "12 Oct 2026", "10:00 – 1:00"],
  },
  {
    key: "2",
    name: "sahara_booking_confirmed",
    category: "UTILITY",
    language: "en",
    purpose: "Booking confirmed (same for online and manual CRM bookings)",
    body:
      "Hi {{1}}, your booking is confirmed ✅\n\nBooking ID: {{2}}\nService: {{3}}\nDate: {{4}}\nTime: {{5}}\nArea: {{6}}\n\nOur team will reach on time. Please keep water and electricity available.",
    examples: ["Priya", "JOB-2026-0150", "Home Deep Cleaning", "12 Oct 2026", "10:00 – 1:00", "Magarpatta, Hadapsar"],
    buttons: [
      { type: "URL", text: "View Booking", url: `${BOOKING_PAGE}{{1}}`, example: `${BOOKING_PAGE}${EX_TOKEN}` },
      { type: "URL", text: "Pay Advance", url: `${BOOKING_PAGE}{{1}}`, example: `${BOOKING_PAGE}${EX_TOKEN}` },
      { type: "QUICK_REPLY", text: "Pay After Service" },
      { type: "QUICK_REPLY", text: "Google Review" },
    ],
  },
  {
    key: "3",
    name: "sahara_booking_rescheduled",
    category: "UTILITY",
    language: "en",
    purpose: "Booking rescheduled",
    body: "Hi {{1}}, your booking {{2}} for {{3}} has been rescheduled to {{4}} ({{5}}).\nReply here if this doesn't suit you.",
    examples: ["Priya", "JOB-2026-0150", "Home Deep Cleaning", "14 Oct 2026", "11:00 – 2:00"],
    buttons: [{ type: "URL", text: "View Booking", url: `${BOOKING_PAGE}{{1}}`, example: `${BOOKING_PAGE}${EX_TOKEN}` }],
  },
  {
    key: "4",
    name: "sahara_booking_cancelled",
    category: "UTILITY",
    language: "en",
    purpose: "Booking cancelled",
    body: "Hi {{1}}, your booking {{2}} for {{3}} on {{4}} has been cancelled.\nReply here or call 8956567130 if you'd like to book a new date.",
    examples: ["Priya", "JOB-2026-0150", "Home Deep Cleaning", "12 Oct 2026"],
  },
  {
    key: "5",
    name: "sahara_advance_payment_request",
    category: "UTILITY",
    language: "en",
    purpose: "Advance payment request",
    body: "Hi {{1}}, to secure booking {{2}} on {{3}}, please pay the advance of ₹{{4}}.\nPayment details are on your booking page.",
    examples: ["Priya", "JOB-2026-0150", "12 Oct 2026", "1,000"],
    buttons: [{ type: "URL", text: "Pay Advance", url: `${BOOKING_PAGE}{{1}}`, example: `${BOOKING_PAGE}${EX_TOKEN}` }],
  },
  {
    key: "6",
    name: "sahara_payment_received",
    category: "UTILITY",
    language: "en",
    purpose: "Payment confirmation (sent only after staff records the payment)",
    body: "Hi {{1}}, we have received your payment of ₹{{2}} for booking {{3}}. Thank you!\n— Sahara Cleaning Services",
    examples: ["Priya", "1,000", "JOB-2026-0150"],
  },
  {
    key: "7",
    name: "sahara_pay_after_service_reminder",
    category: "UTILITY",
    language: "en",
    purpose: "Pay-after-service reminder",
    body: "Hi {{1}}, your {{2}} service (booking {{3}}) is complete. The balance of ₹{{4}} is due as agreed. Payment details are on your booking page.",
    examples: ["Priya", "Home Deep Cleaning", "JOB-2026-0150", "3,999"],
    buttons: [{ type: "URL", text: "Pay Now", url: `${BOOKING_PAGE}{{1}}`, example: `${BOOKING_PAGE}${EX_TOKEN}` }],
  },
  {
    key: "8",
    name: "sahara_service_reminder",
    category: "UTILITY",
    language: "en",
    purpose: "Service reminder (day before)",
    body: "Hi {{1}}, a reminder that your {{2}} service is scheduled for {{3}} ({{4}}) in {{5}}. Please keep water and electricity available.",
    examples: ["Priya", "Home Deep Cleaning", "12 Oct 2026", "10:00 – 1:00", "Magarpatta"],
    buttons: [{ type: "URL", text: "View Booking", url: `${BOOKING_PAGE}{{1}}`, example: `${BOOKING_PAGE}${EX_TOKEN}` }],
  },
  {
    key: "9",
    name: "sahara_job_completed",
    category: "UTILITY",
    language: "en",
    purpose: "Job completed",
    body: "Hi {{1}}, your {{2}} service (booking {{3}}) has been completed. Thank you for choosing Sahara Cleaning Services. Reply here if anything needs our attention.",
    examples: ["Priya", "Home Deep Cleaning", "JOB-2026-0150"],
    buttons: [{ type: "URL", text: "View Booking", url: `${BOOKING_PAGE}{{1}}`, example: `${BOOKING_PAGE}${EX_TOKEN}` }],
  },
  {
    key: "10",
    name: "sahara_review_request",
    category: "MARKETING",
    language: "en",
    purpose: "Google review request (Meta usually treats review asks as marketing)",
    body: "Hi {{1}}, we hope you're happy with your {{2}} service. Could you spare a minute to review Sahara Cleaning Services on Google? It really helps us. Thank you!",
    examples: ["Priya", "Home Deep Cleaning"],
    buttons: [{ type: "QUICK_REPLY", text: "Google Review" }],
  },
  {
    key: "11",
    name: "sahara_customer_followup",
    category: "MARKETING",
    language: "en",
    purpose: "Customer / lead follow-up",
    body: "Hi {{1}}, following up on your enquiry for {{2}}. Would you like us to confirm a date? Reply here or book online.",
    examples: ["Priya", "Home Deep Cleaning"],
    buttons: [{ type: "URL", text: "Book Now", url: `${PUBLIC_BOOKING_URL}/{{1}}`, example: `${PUBLIC_BOOKING_URL}/home-deep-cleaning-pune?utm_source=whatsapp&utm_medium=marketing&utm_campaign=followup` }],
  },
  {
    key: "12",
    name: "sahara_festival_offer",
    category: "MARKETING",
    language: "en",
    purpose: "Festival marketing (Navratri • Dussehra • Diwali)",
    // Festival name and price are variables so a price change (pricing
    // master → HOME_FROM_PRICE) never needs a new template approval.
    body:
      "Hi {{1}}, get ready for {{2}} with Sahara Cleaning Services! We offer Home Deep Cleaning, Office & Commercial Cleaning, Interior Painting and Pest Control across Pune & PCMC. Home deep cleaning starts from ₹{{3}} (1 BHK Premium) with transparent package prices. Book early to get your preferred slot.",
    examples: ["Priya", "Diwali", "4,499"],
    buttons: [
      { type: "URL", text: "Book Now", url: `${PUBLIC_BOOKING_URL}/{{1}}`, example: `${PUBLIC_BOOKING_URL}/offers?utm_source=whatsapp&utm_medium=marketing&utm_campaign=sahara_festival_2026&utm_content=festival_offer` },
      { type: "QUICK_REPLY", text: "Stop promotions" },
    ],
  },
  {
    key: "13",
    name: "sahara_customer_reactivation",
    category: "MARKETING",
    language: "en",
    purpose: "Existing customer reactivation",
    body: "Hi {{1}}, it's been a while since your last {{2}} with Sahara Cleaning Services. Book your next deep clean today — same trained team, transparent package prices.",
    examples: ["Priya", "home deep cleaning"],
    buttons: [
      { type: "URL", text: "Book Now", url: `${PUBLIC_BOOKING_URL}/{{1}}`, example: `${PUBLIC_BOOKING_URL}/home-deep-cleaning-pune?utm_source=whatsapp&utm_medium=marketing&utm_campaign=reactivation` },
      { type: "QUICK_REPLY", text: "Stop promotions" },
    ],
  },
  // ── Rich Diwali broadcast (owner request 2026-10-10): image header + emoji copy. Submitted in
  // WhatsApp Manager; offered in the CRM broadcast dropdown only after Meta shows it Active.
  // Meta does not allow emojis in button labels, so the button reads "Book Festival Clean".
  {
    key: "14",
    name: "sahara_diwali_festival_offer",
    category: "MARKETING",
    language: "en",
    purpose: "Diwali festival marketing — image header, emoji copy, Book Festival Clean + Stop promotions",
    header: { type: "IMAGE", sample: `${PUBLIC_BOOKING_URL}/marketing/diwali-offer-banner.jpg` },
    body:
      "Hi {{1}}, Diwali is around the corner! 🪔 Get your home & office sparkling clean 🧹 with Sahara's Special Festival Offers.\n\n✨ 100% In-House Verified Staff\n✨ Transparent Pricing & Pay After Service",
    examples: ["Priya"],
    buttons: [
      { type: "URL", text: "Book Festival Clean", url: `${PUBLIC_BOOKING_URL}/{{1}}`, example: `${PUBLIC_BOOKING_URL}/offers?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=sahara_broadcast_diwali_2026` },
      { type: "QUICK_REPLY", text: "Stop promotions" },
    ],
  },
  // ── Service campaigns (owner 2026-10-18): submitted in WhatsApp Manager on the production WABA and shown Active
  // by Meta the same day. Image header, one name variable, one dynamic-path URL button, "Stop promotions".
  // MARKETING category → the consent guard in sendWhatsAppTemplate only lets them reach a recorded opt-in;
  // the header image link is passed per send (lib/whatsapp-service-offers.ts).
  {
    key: "15",
    name: "sahara_pest_control_offer",
    category: "MARKETING",
    language: "en",
    purpose: "Pest control campaign — image header, Book Pest Control + Stop promotions",
    header: { type: "IMAGE", sample: `${PUBLIC_BOOKING_URL}/marketing/pest-control-offer-banner.jpg` },
    body:
      "Hi {{1}}, is your home ready for the season? 🐜 Sahara Cleaning Services offers cockroach, termite, bed bug and ant treatment across Pune & PCMC — trained in-house staff, transparent pricing, and pay after service. Book a visit in under a minute.",
    footer: "Sahara Cleaning Services · Serving Pune since 2012",
    examples: ["Priya"],
    buttons: [
      { type: "URL", text: "Book Pest Control", url: `${PUBLIC_BOOKING_URL}/{{1}}`, example: `${PUBLIC_BOOKING_URL}/pest-control-pune?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=sahara_pest_control_2026` },
      { type: "QUICK_REPLY", text: "Stop promotions" },
    ],
  },
  {
    key: "16",
    name: "sahara_painting_offer",
    category: "MARKETING",
    language: "en",
    purpose: "Interior painting campaign — image header, Book Free Inspection + Stop promotions",
    header: { type: "IMAGE", sample: `${PUBLIC_BOOKING_URL}/marketing/painting-offer-banner.jpg` },
    body:
      "Hi {{1}}, planning to repaint? 🎨 Sahara Cleaning Services does interior and texture painting in Pune & PCMC with a free site inspection and a written quote before work starts. Trained in-house team, clean finish, furniture covered.",
    footer: "Sahara Cleaning Services · Serving Pune since 2012",
    examples: ["Priya"],
    buttons: [
      { type: "URL", text: "Book Free Inspection", url: `${PUBLIC_BOOKING_URL}/{{1}}`, example: `${PUBLIC_BOOKING_URL}/interior-painting-pune?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=sahara_painting_2026` },
      { type: "QUICK_REPLY", text: "Stop promotions" },
    ],
  },
  {
    key: "17",
    name: "sahara_facility_management_offer",
    category: "MARKETING",
    language: "en",
    purpose: "Facility management / housekeeping AMC (B2B) — image header, Request a Proposal + Stop promotions",
    header: { type: "IMAGE", sample: `${PUBLIC_BOOKING_URL}/marketing/facility-management-offer-banner.jpg` },
    body:
      "Hi {{1}}, need reliable housekeeping for your office, society or commercial complex? 🏢 Sahara Cleaning Services provides trained housekeeping staff and facility management on monthly AMC across Pune & PCMC, with a site visit and a written scope before you decide.",
    footer: "Sahara Cleaning Services · Serving Pune since 2012",
    examples: ["Priya"],
    buttons: [
      { type: "URL", text: "Request a Proposal", url: `${PUBLIC_BOOKING_URL}/{{1}}`, example: `${PUBLIC_BOOKING_URL}/housekeeping-services?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=sahara_facility_2026` },
      { type: "QUICK_REPLY", text: "Stop promotions" },
    ],
  },
  // ── V2 (owner-approved Option C, 2026-10-06). Existing approved templates above stay unchanged. ──
  // Meta allows at most 2 URL buttons and percent-encodes special characters in a URL variable,
  // so both buttons use fixed PATH routes and the variable carries only the plain Job.publicToken.
  {
    key: "2b",
    name: "sahara_booking_confirmed_v2",
    category: "UTILITY",
    language: "en",
    purpose: "Booking confirmed — View Quotation + Payment Options (path routes)",
    body:
      "Hi {{1}}, your booking is confirmed ✅\n\nBooking ID: {{2}}\nService: {{3}}\nDate: {{4}}\nTime: {{5}}\nArea: {{6}}\n\nOur team will reach on time. Please keep water and electricity available.",
    examples: ["Priya", "JOB-2026-0150", "Home Deep Cleaning", "12 Oct 2026", "10:00 – 1:00", "Magarpatta, Hadapsar"],
    buttons: [
      { type: "URL", text: "View Quotation", url: `${PUBLIC_BOOKING_URL}/booking/quotation/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/quotation/${EX_TOKEN}` },
      { type: "URL", text: "Payment Options", url: `${PUBLIC_BOOKING_URL}/booking/pay/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/pay/${EX_TOKEN}` },
    ],
  },
  // ── V3 (owner request 2026-10-10): the 3 actions the owner asked for. Meta allows at most
  // 2 URL buttons per template, so Google Review is a Quick Reply — the webhook answers a
  // "Google Review" tap with the Settings review link (inside the 24-hour window, no extra cost).
  // The pay page (/booking/pay/<token>) offers both Pay Advance and Pay After Service.
  // Submit in WhatsApp Manager; used only when WHATSAPP_BOOKING_TEMPLATE=v3 is set after approval.
  {
    key: "2c",
    name: "sahara_booking_confirmed_v3",
    category: "UTILITY",
    language: "en",
    purpose: "Booking confirmed — View Quotation + Pay Now / Later + Google Review",
    body:
      "Hi {{1}}, your booking is confirmed ✅\n\nBooking ID: {{2}}\nService: {{3}}\nDate: {{4}}\nTime: {{5}}\nArea: {{6}}\n\nOur team will reach on time. Please keep water and electricity available.",
    examples: ["Priya", "JOB-2026-0150", "Home Deep Cleaning", "12 Oct 2026", "10:00 – 1:00", "Magarpatta, Hadapsar"],
    buttons: [
      { type: "URL", text: "View Quotation", url: `${PUBLIC_BOOKING_URL}/booking/quotation/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/quotation/${EX_TOKEN}` },
      { type: "URL", text: "Pay Now / Later", url: `${PUBLIC_BOOKING_URL}/booking/pay/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/pay/${EX_TOKEN}` },
      { type: "QUICK_REPLY", text: "Google Review" },
    ],
  },
  // ── V4 (owner Phase 2, 2026-10-22): ONE confirmation with all three actions. Meta allows at most 2 URL buttons, and
  // v3's "Google Review" quick reply does nothing while auto-replies are off — so the review link is a body parameter
  // ({{7}}, the Settings review URL) and the two buttons stay View Quotation + Pay Now / Later.
  // Submit in WhatsApp Manager; used only when WHATSAPP_BOOKING_TEMPLATE=v4 is set after Meta approves it.
  {
    key: "2d",
    name: "sahara_booking_confirmed_v4",
    category: "UTILITY",
    language: "en",
    purpose: "Booking confirmed — View Quotation + Pay Now / Later buttons, Google review link in the message",
    body:
      "Hi {{1}}, your booking is confirmed ✅\n\nBooking ID: {{2}}\nService: {{3}}\nDate: {{4}}\nTime: {{5}}\nArea: {{6}}\n\nAfter your service, you can rate us on Google: {{7}}\n\nOur team will reach on time. Please keep water and electricity available.",
    examples: ["Priya", "JOB-2026-0150", "Home Deep Cleaning", "12 Oct 2026", "10:00 – 1:00", "Magarpatta, Hadapsar", GOOGLE_REVIEW_URL],
    buttons: [
      { type: "URL", text: "View Quotation", url: `${PUBLIC_BOOKING_URL}/booking/quotation/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/quotation/${EX_TOKEN}` },
      { type: "URL", text: "Pay Now / Later", url: `${PUBLIC_BOOKING_URL}/booking/pay/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/pay/${EX_TOKEN}` },
    ],
  },
  // ── Owner-approved 2026-10-22 (master brief, corrected): strictly UTILITY — booking facts + the two existing public pages
  // + helpline as text. No urgency, slot-release claims, socials or offers (those would make Meta re-classify it as
  // Marketing); socials/offers belong in a separate opted-in Marketing flow. Built to be PREPARED in WhatsApp Manager:
  // the owner clicks Submit. Used only after Meta approves it and WHATSAPP_BOOKING_TEMPLATE=v5 is set.
  {
    key: "2e",
    name: "sahara_booking_confirmed_v5",
    category: "UTILITY",
    language: "en",
    purpose: "Booking confirmed — image header, View Quotation + Pay Now / Later buttons, cleaning video + Instagram + Facebook links, helpline in text",
    header: { type: "IMAGE", sample: BOOKING_HEADER_IMAGE },
    // Owner 2026-10-23: no Google review link and no ladder / water notes; the cleaning video and social profiles are plain text
    // links (not variables), so the six body parameters are unchanged. Meta may re-classify promotional-looking text as Marketing.
    body:
      `Hi {{1}}, your booking is confirmed ✅\n\nBooking ID: {{2}}\nService: {{3}}\nDate: {{4}}\nTime: {{5}}\nArea: {{6}}\n\nView your quotation or pay the advance using the buttons below.\n\n▶️ Watch our cleaning process: ${profileUrl("youtube")}\n📸 Instagram: ${profileUrl("instagram")}\n👍 Facebook: ${profileUrl("facebook")}\n\nFor any help, call us on 7083347130 / 8956567130.`,
    examples: ["Priya", "JOB-2026-0150", "Home Deep Cleaning", "12 Oct 2026", "10:00 – 1:00", "Magarpatta, Hadapsar"],
    buttons: [
      { type: "URL", text: "View Quotation", url: `${PUBLIC_BOOKING_URL}/booking/quotation/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/quotation/${EX_TOKEN}` },
      { type: "URL", text: "Pay Now / Later", url: `${PUBLIC_BOOKING_URL}/booking/pay/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/pay/${EX_TOKEN}` },
    ],
  },
  {
    key: "6b",
    name: "sahara_payment_received_v1",
    category: "UTILITY",
    language: "en",
    purpose: "Payment confirmation with receipt page + helpline call button (sent only after staff records the payment)",
    header: { type: "IMAGE", sample: BOOKING_HEADER_IMAGE },
    body:
      "Hi {{1}},\nWe have successfully received your advance payment of ₹{{2}} for Booking ID {{3}}.\n\n🧾 Payment Details:\n• Payment Mode: {{4}}\n• Remaining Balance: ₹{{5}}\n\nOur team will reach your location on schedule.",
    examples: ["Priya", "1,000", "JOB-2026-0150", "UPI", "2,999"],
    buttons: [
      { type: "URL", text: "View Receipt", url: `${PUBLIC_BOOKING_URL}/booking/receipt/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/receipt/${EX_TOKEN}` },
      { type: "PHONE_NUMBER", text: "Call Helpline", phone: "+917083347130" },
    ],
  },
  {
    key: "9b",
    name: "sahara_job_completed_v1",
    category: "UTILITY",
    language: "en",
    purpose: "Job completed — balance due, Pay Balance and Google review buttons",
    body:
      "Hi {{1}}, your {{2}} service has been completed. Thank you for choosing Sahara Cleaning Services.\n\nBalance due: ₹{{3}}\n\nWe would love your feedback — please tap a button below.",
    examples: ["Priya", "Home Deep Cleaning", "2,999"],
    buttons: [
      { type: "URL", text: "Pay Balance", url: `${PUBLIC_BOOKING_URL}/booking/pay/{{1}}`, example: `${PUBLIC_BOOKING_URL}/booking/pay/${EX_TOKEN}` },
      { type: "URL", text: "Rate Us on Google", url: GOOGLE_REVIEW_URL },
    ],
  },
  // ── Owner 2026-10-23: "Work Started" customer message. UTILITY, no buttons, no offers. Sent when staff mark Work Started, only once
  // Meta approves it and WHATSAPP_USE_TEMPLATES=on + WHATSAPP_STARTED_TEMPLATE=v1 are set.
  {
    key: "8b",
    name: "sahara_service_started_v1",
    category: "UTILITY",
    language: "en",
    purpose: "Work started — the team has begun the service (sent when staff tap Work Started)",
    body:
      "Hi {{1}}, our team has reached your location and started your {{2}} service (booking {{3}}). We will let you know once it is complete.\n\nFor any help, call us on 7083347130 / 8956567130.",
    examples: ["Priya", "Home Deep Cleaning", "JOB-2026-0150"],
  },
  {
    key: "10b",
    name: "sahara_review_request_v2",
    category: "MARKETING",
    language: "en",
    purpose: "Google review request — direct (static) Google review URL button, no auto-reply needed",
    body: "Hi {{1}}, we hope you're happy with your {{2}} service. Could you spare a minute to review Sahara Cleaning Services on Google? It really helps us. Thank you!",
    examples: ["Priya", "Home Deep Cleaning"],
    buttons: [{ type: "URL", text: "Google Review", url: GOOGLE_REVIEW_URL }],
  },
  // ── Owner 2026-10-23: lifecycle reminders. Sent only when Meta has approved them, WHATSAPP_REMINDERS=on, and the outbound mode allows it
  // (re-booking is MARKETING: opt-in numbers only; the payment follow-up is UTILITY).
  {
    key: "rem1",
    name: "sahara_rebook_reminder_v1",
    category: "MARKETING",
    language: "en",
    purpose: "Re-booking reminder 6 / 12 months after a deep-cleaning service (opt-in contacts only)",
    body:
      "Hi {{1}}, it has been {{2}} since your {{3}} with Sahara Cleaning Services. A fresh deep clean keeps your home healthy and hygienic. Tap below to book your next service.\n\nReply STOP to opt out.",
    examples: ["Priya", "6 months", "Home Deep Cleaning"],
    buttons: [
      { type: "URL", text: "Book Now", url: `${PUBLIC_BOOKING_URL}/booking` },
      { type: "PHONE_NUMBER", text: "Call Helpline", phone: "+917083347130" },
    ],
  },
  {
    key: "rem2",
    name: "sahara_payment_due_reminder_v1",
    category: "UTILITY",
    language: "en",
    purpose: "Friendly follow-up for an overdue unpaid GST / corporate invoice",
    body:
      "Hi {{1}}, a friendly reminder that invoice {{2}} for ₹{{3}} (due {{4}}) is still pending. Please pay by UPI to 7083347130 or call us if it is already paid. Thank you for your business.",
    examples: ["Acme Traders", "SC/SL/26-27/1501", "11,800", "05 Oct 2026"],
    buttons: [{ type: "PHONE_NUMBER", text: "Call Helpline", phone: "+917083347130" }],
  },
];

export function templateByName(name: string) {
  return CLOUD_TEMPLATES.find((t) => t.name === name) ?? null;
}

/** Fills {{n}} placeholders for the logged preview of a template send. */
export function renderTemplatePreview(t: CloudTemplate, params: string[]) {
  return t.body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => params[Number(n) - 1] ?? `{{${n}}}`);
}

export function placeholderCount(t: CloudTemplate) {
  return new Set(t.body.match(/\{\{\d+\}\}/g) ?? []).size;
}

/** Number of URL buttons that take a dynamic {{1}} suffix. */
export function dynamicUrlButtons(t: CloudTemplate) {
  return (t.buttons ?? []).map((b, index) => ({ b, index })).filter(({ b }) => b.type === "URL" && b.url.endsWith("{{1}}"));
}
