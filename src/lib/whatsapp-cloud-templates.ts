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

export type TemplateButton =
  | { type: "URL"; text: string; url: string; example?: string }
  | { type: "QUICK_REPLY"; text: string };

export type CloudTemplate = {
  key: string;
  name: string;
  category: "UTILITY" | "MARKETING";
  language: "en";
  purpose: string;
  body: string;
  /** Example value per {{n}} body placeholder, in order (Meta requires examples). */
  examples: string[];
  buttons?: TemplateButton[];
};

const BOOKING_PAGE = `${PUBLIC_BOOKING_URL}/booking/`;
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
