// WhatsApp Cloud API message templates for the +91 9175220270 sender.
//
// These are PREPARED, not submitted: each must be created and approved in
// WhatsApp Manager → Message templates (same name, category, language and
// body) before it can be sent. The WhatsApp Inbox template picker lists
// them; Meta rejects any send whose template isn't approved yet, and that
// rejection is logged on the Message Log.
//
// Category follows Meta's rules: UTILITY = about an existing enquiry,
// booking, job or payment the customer initiated; MARKETING = anything
// promotional or re-engaging (offers, generic follow-ups, review asks).
// Meta may re-categorise on review — its decision wins.

export type CloudTemplate = {
  key: string;
  name: string;
  category: "UTILITY" | "MARKETING";
  language: "en";
  purpose: string;
  body: string;
  /** Example value per {{n}} placeholder, in order (Meta requires examples). */
  examples: string[];
};

export const CLOUD_TEMPLATES: CloudTemplate[] = [
  {
    key: "J",
    name: "sahara_test_booking",
    category: "MARKETING",
    language: "en",
    purpose: "Controlled QA test (first message after go-live)",
    body:
      "Hello {{1}}, this is Sahara Cleaning Services.\nWe are testing our WhatsApp booking communication system.\nFor any cleaning service enquiry or booking, please contact us.\nThank you.",
    examples: ["SAHARA QA TEST"],
  },
  {
    key: "A",
    name: "sahara_booking_acknowledgement",
    category: "UTILITY",
    language: "en",
    purpose: "Booking/enquiry acknowledgement",
    body:
      "Hi {{1}}, thank you for contacting Sahara Cleaning Services. We have received your enquiry {{2}} for {{3}}. Our team will call you shortly to confirm the details.",
    examples: ["Priya", "LD-2026-0130", "Home Deep Cleaning"],
  },
  {
    key: "B",
    name: "sahara_booking_confirmation",
    category: "UTILITY",
    language: "en",
    purpose: "Booking confirmation",
    body:
      "Hi {{1}}, your booking {{2}} for {{3}} is confirmed for {{4}}, {{5}}.\nAddress: {{6}}\nOur team will reach on time. Please keep water and electricity available.",
    examples: ["Priya", "JOB-2026-0150", "Home Deep Cleaning", "12 Oct 2026", "10:00 AM – 1:00 PM", "Magarpatta, Hadapsar"],
  },
  {
    key: "C",
    name: "sahara_appointment_reminder",
    category: "UTILITY",
    language: "en",
    purpose: "24-hour appointment reminder",
    body:
      "Hi {{1}}, a reminder that your {{2}} service is scheduled for tomorrow, {{3}} ({{4}}). Please keep water and electricity available. Reply here if you need to reschedule.",
    examples: ["Priya", "Home Deep Cleaning", "12 Oct 2026", "10:00 AM – 1:00 PM"],
  },
  {
    key: "D",
    name: "sahara_team_dispatch",
    category: "UTILITY",
    language: "en",
    purpose: "Team dispatch notification (to staff)",
    body:
      "Job {{1}} assigned to you: {{2}} on {{3}} at {{4}}.\nCustomer: {{5}}\nArea: {{6}}\nPlease reach on time and update the job status in Sahara OS.",
    examples: ["JOB-2026-0150", "Home Deep Cleaning", "12 Oct 2026", "10:00 AM", "Priya", "Magarpatta"],
  },
  {
    key: "E",
    name: "sahara_advance_reminder",
    category: "UTILITY",
    language: "en",
    purpose: "Advance / payment reminder",
    body:
      "Hi {{1}}, a gentle reminder that an advance of ₹{{2}} is pending for booking {{3}}. You can pay here: {{4}}\nThank you, Sahara Cleaning Services.",
    examples: ["Priya", "1,000", "JOB-2026-0150", "https://booking.saharacleaningservices.com/j/JOB-2026-0150#payment"],
  },
  {
    key: "F",
    name: "sahara_service_completed",
    category: "UTILITY",
    language: "en",
    purpose: "Service completion",
    body:
      "Hi {{1}}, your {{2}} service (booking {{3}}) has been completed. Thank you for choosing Sahara Cleaning Services. Reply here if anything needs our attention.",
    examples: ["Priya", "Home Deep Cleaning", "JOB-2026-0150"],
  },
  {
    key: "G",
    name: "sahara_review_request",
    category: "MARKETING",
    language: "en",
    purpose: "Google review request (Meta usually treats review asks as marketing)",
    body:
      "Hi {{1}}, we hope you're happy with your {{2}} service. Could you spare a minute to review Sahara Cleaning Services on Google? {{3}}\nThank you!",
    examples: ["Priya", "Home Deep Cleaning", "https://g.page/r/sahara-review"],
  },
  {
    key: "H",
    name: "sahara_lead_followup",
    category: "MARKETING",
    language: "en",
    purpose: "Lead follow-up (enquiry not yet booked)",
    body:
      "Hi {{1}}, following up on your enquiry for {{2}}. Would you like us to confirm a date? Reply here or call us at 8956567130.",
    examples: ["Priya", "Home Deep Cleaning"],
  },
  {
    key: "I",
    name: "sahara_festival_offer",
    category: "MARKETING",
    language: "en",
    purpose: "Festival cleaning offer (Navratri • Dussehra • Diwali)",
    body:
      "Hi {{1}}, get your home & workplace festival-ready with Sahara Cleaning Services. Home deep cleaning from ₹3,999 (1 BHK Premium). Festival-season demand can lead to price revisions — book early to secure the current listed price: {{2}}\nReply STOP to opt out.",
    examples: ["Priya", "https://booking.saharacleaningservices.com/offers"],
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
