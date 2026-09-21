// Deterministic WhatsApp message text for every Phase 3 automation. Kept
// separate from src/lib/whatsapp.ts (the transport) so the wording can be
// edited without touching send/queue logic — mirrors the existing
// src/lib/ai/quotation.ts + payment-reminder.ts pattern.
import { COMPANY } from "@/lib/constants";
import { GALLERY_PUBLIC_URL, CLEANING_TIPS_URL } from "@/lib/gallery";
import { formatINR, formatDate } from "@/lib/utils";

type BookingConfirmationInput = {
  customerName: string;
  service: string;
  area: string;
  address?: string | null;
  date: Date;
  timeSlot: string;
  jobNumber: string;
  team?: number | null;
  supervisorName?: string | null;
  supervisorMobile?: string | null;
};

export function bookingConfirmationMessage(input: BookingConfirmationInput) {
  const teamLine = input.team ? `Team: Sahara Team ${input.team}` : `Team: Assigned & briefed`;
  const supLine = input.supervisorName
    ? `Supervisor: ${input.supervisorName}${input.supervisorMobile ? ` (${input.supervisorMobile})` : ""}`
    : null;
  return [
    `Hi ${input.customerName}, your booking with ${COMPANY.name} is confirmed! ✅`,
    ``,
    `Booking ID: ${input.jobNumber}`,
    `Date: ${formatDate(input.date)}`,
    `Time: ${input.timeSlot}`,
    `Service: ${input.service}`,
    `Address: ${input.address?.trim() || input.area}`,
    teamLine,
    supLine,
    ``,
    `Track your booking: https://app.saharacleaningservices.com/j/${input.jobNumber}`,
    `Before/After gallery: ${GALLERY_PUBLIC_URL}`,
    `Cleaning & aftercare tips: ${CLEANING_TIPS_URL}`,
    ``,
    `Our team will reach you on time. Call ${COMPANY.phones[0]} for any changes.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** Short SMS fallback for the booking confirmation. */
export function bookingConfirmationSms(input: BookingConfirmationInput) {
  return [
    `${COMPANY.name}: Booking ${input.jobNumber} confirmed.`,
    `${formatDate(input.date)} ${input.timeSlot} - ${input.service}.`,
    `Track: https://app.saharacleaningservices.com/j/${input.jobNumber}`,
    `Help: ${COMPANY.phones[0]}`,
  ].join(" ");
}

/**
 * Premium "Interactive Booking" WhatsApp confirmation — the ONE message sent
 * the moment a booking is confirmed, whether the enquiry started on the
 * website booking form, was entered manually in the CRM, or came in as a
 * Google Business Profile (GMB) lead. All three paths flow through the same
 * confirmBooking() action (src/server/actions/leads.ts), so this is always
 * the single, de-duplicated confirmation for a job — see the WhatsAppMessage
 * lookup guard there before this is sent.
 *
 * Matches the approved Sahara branded WhatsApp mockup: four actions — View
 * Booking Details, Pay Now / Payment Link, Before/After Photos and Google
 * Review — plus a footer with both support numbers, the website and email.
 * The Payment link only appears while a balance is actually due; once
 * settled it reads as a plain confirmation line instead. The Google Review
 * link only appears when Settings → Google Review Link is filled in.
 *
 * WhatsApp's Cloud API only supports more than 3 buttons, or any link-type
 * button (e.g. "View Booking Details" as a tappable button rather than a
 * pasted link), inside a pre-approved Meta message Template — not in a
 * plain-text/ad-hoc message. See BOOKING_CONFIRMATION_META_TEMPLATE below
 * for the exact template (header image, body variables, buttons) to submit
 * for approval in Meta Business Manager once WhatsApp Cloud API is
 * connected. Until then, the four actions below are rendered as
 * clearly-labelled tappable links so the customer gets the same
 * information and the same destinations today. Once the template is
 * APPROVED, swap the sendWhatsApp() call in confirmBooking() for a
 * `type: "template"` send using BOOKING_CONFIRMATION_META_TEMPLATE's
 * component values (trackingUrl / balance / gallery / review as the
 * button + body parameters) — no other change needed here.
 */
export function premiumBookingConfirmationMessage(input: {
  customerName: string;
  jobNumber: string;
  service: string;
  date: Date;
  timeSlot: string;
  address?: string | null;
  area: string;
  balanceDue?: number | null;
  googleReviewUrl?: string | null;
}) {
  const trackingUrl = `https://app.saharacleaningservices.com/j/${input.jobNumber}`;
  const location = input.address?.trim() || input.area;
  const hasBalance = !!input.balanceDue && input.balanceDue > 0;
  const paymentLine = hasBalance
    ? `💳 Pay Now / Payment Link — ${formatINR(input.balanceDue!)} due: ${trackingUrl}#payment`
    : `💳 Payment — fully settled, thank you!`;

  return [
    `✅ *Booking Confirmed — ${COMPANY.name}*`,
    ``,
    `Hi ${input.customerName},`,
    `*Your booking has been confirmed!* ✅`,
    `Thank you for choosing ${COMPANY.name}. We're excited to serve you!`,
    ``,
    `🆔 Booking ID: ${input.jobNumber}`,
    `🗓️ Service Date: ${formatDate(input.date)}`,
    `⏰ Time: ${input.timeSlot}`,
    `🧹 Service: ${input.service}`,
    `📍 Address: ${location}`,
    ``,
    `👥 Our team will arrive on time. You'll get a WhatsApp message before they start.`,
    `Keep your space ready, we'll take care of the rest! 🙏`,
    ``,
    `— — — — — — — — — —`,
    `📄 View Booking Details: ${trackingUrl}`,
    paymentLine,
    `🖼️ Before/After Photos: ${GALLERY_PUBLIC_URL}`,
    input.googleReviewUrl ? `⭐ Give Google Review: ${input.googleReviewUrl}` : null,
    `— — — — — — — — — —`,
    ``,
    `Need help? We're just a message away!`,
    `📞 Operational Support: ${COMPANY.phones[1]}`,
    `📱 Booking & Feedback: ${COMPANY.phones[0]}`,
    `🌐 ${COMPANY.website ?? "www.saharacleaningservices.com"}`,
    `✉️ ${COMPANY.email}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/**
 * The exact Meta WhatsApp message Template to create in Business Manager
 * once WhatsApp Cloud API is connected (Settings → Integrations). Mirrors
 * premiumBookingConfirmationMessage above 1:1, translated into Meta's real
 * template constraints (verified against Meta's current template rules —
 * a template may mix button groups but not interleave them, with a hard
 * cap of 2 URL buttons and 1 phone-number button per template):
 *
 *   HEADER  — IMAGE, the official Sahara logo (/brand/sahara-logo.png)
 *   BODY    — 5 variables: {{1}} name, {{2}} booking ID, {{3}} date,
 *             {{4}} time, {{5}} service, {{6}} address — plus the fixed
 *             friendly note and the fixed contact block (footer can't hold
 *             two numbers + a website + an email, so they live in the body).
 *   BUTTONS — URL "View Booking Details" (dynamic /j/{{1}} suffix),
 *             URL "Pay Now / Payment Link" (dynamic /j/{{1}}#payment),
 *             QUICK_REPLY "Before / After Photos",
 *             QUICK_REPLY "Give Google Review".
 *             The two QUICK_REPLY buttons don't open a link directly —
 *             Meta templates cap URL buttons at 2 — so the webhook
 *             (src/app/api/webhooks/whatsapp/route.ts, once built) replies
 *             instantly with the gallery / review link when tapped. This
 *             keeps all four actions on the confirmation message, exactly
 *             like the approved mockup, while staying inside Meta's rules.
 *
 * Category UTILITY (transactional, sent outside the 24-hour session window
 * without needing a prior customer message). Submit this exact JSON via
 * Meta Business Manager → WhatsApp Manager → Message Templates, or the
 * Cloud API POST /{waba-id}/message_templates endpoint.
 */
export const BOOKING_CONFIRMATION_META_TEMPLATE = {
  name: "booking_confirmation_v1",
  language: "en",
  category: "UTILITY",
  components: [
    {
      type: "HEADER",
      format: "IMAGE",
      example: { header_url: ["https://app.saharacleaningservices.com/brand/sahara-logo.png"] },
    },
    {
      type: "BODY",
      text:
        "Hi {{1}},\n*Your booking has been confirmed!* ✅\nThank you for choosing Sahara Cleaning Services. We're excited to serve you!\n\n" +
        "🆔 Booking ID: {{2}}\n🗓️ Service Date: {{3}}\n⏰ Time: {{4}}\n🧹 Service: {{5}}\n📍 Address: {{6}}\n\n" +
        "👥 Our team will arrive on time. You'll get a WhatsApp message before they start.\nKeep your space ready, we'll take care of the rest! 🙏\n\n" +
        "Need help? We're just a message away!\n📞 Operational Support: 8956567130\n📱 Booking & Feedback: 7083347130\n🌐 www.saharacleaningservices.com\n✉️ contact@saharacleaningservices.com",
      example: {
        body_text: [
          [
            "Altaf Shaikh",
            "SHR-240916-001",
            "Tue, 17 Sept 2026",
            "10:00 AM – 1:00 PM",
            "Full Home Deep Cleaning",
            "Andheri West, Mumbai",
          ],
        ],
      },
    },
    {
      type: "BUTTONS",
      buttons: [
        {
          type: "URL",
          text: "View Booking Details",
          url: "https://app.saharacleaningservices.com/j/{{1}}",
          example: ["https://app.saharacleaningservices.com/j/SHR-240916-001"],
        },
        {
          type: "URL",
          text: "Pay Now / Payment Link",
          url: "https://app.saharacleaningservices.com/j/{{1}}#payment",
          example: ["https://app.saharacleaningservices.com/j/SHR-240916-001#payment"],
        },
        { type: "QUICK_REPLY", text: "Before / After Photos" },
        { type: "QUICK_REPLY", text: "Give Google Review" },
      ],
    },
  ],
} as const;

/**
 * Premium "Job Completed" Google Review request — sent ONCE a Job's status
 * transitions to COMPLETED (see src/server/actions/jobs.ts), never as part
 * of the booking confirmation. Matches the visual design language of
 * premiumBookingConfirmationMessage above so the customer recognizes it as
 * the same premium Sahara flow. De-duplicated the same way (a WhatsAppMessage
 * lookup guard with kind "REVIEW_REQUEST" + relatedType "Job" before send).
 */
export function premiumReviewRequestMessage(input: {
  customerName: string;
  jobNumber: string;
  service: string;
  googleReviewUrl?: string | null;
}) {
  const trackingUrl = `https://app.saharacleaningservices.com/j/${input.jobNumber}`;
  return [
    `🎉 *Service Completed — ${COMPANY.name}*`,
    ``,
    `Hi ${input.customerName}, thank you for choosing us for your ${input.service}!`,
    `We hope you're happy with the work.`,
    ``,
    `— — — — — — — — — —`,
    input.googleReviewUrl ? `⭐ Leave a Google Review: ${input.googleReviewUrl}` : null,
    `📄 View Booking / Before-After Photos: ${trackingUrl}`,
    `— — — — — — — — — —`,
    ``,
    `📞 ${COMPANY.phones[0]}`,
    `📱 ${COMPANY.phones[1]}`,
    `🌐 ${COMPANY.website ?? "www.saharacleaningservices.com"}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function teamDispatchMessage(input: {
  customerName: string;
  mobile?: string | null;
  area: string;
  address?: string | null;
  mapLink: string | null;
  service: string;
  flatType?: string | null;
  date: Date;
  timeSlot: string;
  team?: number | null;
  supervisor?: string | null;
  vehicle: string | null;
  materials: string[];
  notes?: string | null;
}) {
  const lines = [
    `📋 Job Dispatch — ${formatDate(input.date)}`,
    ``,
    input.team ? `Team: ${input.team}` : null,
    `Customer: ${input.customerName}`,
    // Customer phone is deliberately NOT shared with field crew — they reach
    // the customer through the office. See the office job card for contact.
    `Area: ${input.area}`,
    input.address ? `Address: ${input.address}` : null,
    input.mapLink ? `Map: ${input.mapLink}` : null,
    `Service: ${input.service}`,
    input.flatType ? `Flat / Type: ${input.flatType}` : null,
    `Date: ${formatDate(input.date)}`,
    `Time Slot: ${input.timeSlot}`,
    input.supervisor ? `Supervisor: ${input.supervisor}` : null,
    `Vehicle: ${input.vehicle ?? "Not assigned yet"}`,
    input.materials.length ? `Material: ${input.materials.join(", ")}` : `Material: —`,
    input.notes ? `Notes: ${input.notes}` : null,
    ``,
    `— ${COMPANY.name}`,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

/**
 * Plain-text job card for sharing on WhatsApp (wa.me / Send).
 * `audience: "team"` produces the crew-safe card — customer phone hidden,
 * Maps link kept prominent. `audience: "office"` keeps the contact details.
 */
export function jobCardMessage(input: {
  jobNumber: string;
  customerName: string;
  mobile: string;
  alternateMobile?: string | null;
  address: string;
  mapLink?: string | null;
  date: Date;
  timeSlot: string;
  service: string;
  flatType?: string | null;
  packageName?: string | null;
  team?: number | null;
  supervisor?: string | null;
  crew?: string[];
  paymentStatus?: string | null;
  advance?: number | null;
  balance?: number | null;
  notes?: string | null;
  audience?: "team" | "office";
}) {
  const team = input.audience === "team";
  return [
    `🧾 ${COMPANY.name} — Job Card${team ? " (Team)" : ""}`,
    `${input.jobNumber}`,
    ``,
    `Customer: ${input.customerName}`,
    team ? null : `Mobile: ${input.mobile}`,
    team || !input.alternateMobile ? null : `Alt: ${input.alternateMobile}`,
    `Address: ${input.address}`,
    input.mapLink ? `📍 Maps: ${input.mapLink}` : null,
    ``,
    `Date: ${formatDate(input.date)}`,
    `Time Slot: ${input.timeSlot}`,
    `Service: ${input.service}`,
    input.flatType ? `Flat / Type: ${input.flatType}` : null,
    input.packageName ? `Package: ${input.packageName}` : null,
    input.team ? `Team: ${input.team}` : null,
    input.crew && input.crew.length ? `Crew: ${input.crew.join(", ")}` : null,
    input.supervisor ? `Supervisor: ${input.supervisor}` : null,
    team ? null : ``,
    team || !input.paymentStatus ? null : `Payment: ${input.paymentStatus}`,
    team || input.advance == null ? null : `Advance: ${formatINR(input.advance)}`,
    team || input.balance == null ? null : `Balance: ${formatINR(input.balance)}`,
    input.notes ? `\nNotes: ${input.notes}` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/**
 * Universal "Send Payment Link" message — used from Booking, Lead, Job and the
 * Payment page. Includes the quote / advance / balance and the company's
 * UPI / QR / bank instructions so the customer can pay without any typing.
 */
export function paymentRequestMessage(input: {
  customerName?: string | null;
  bookingId?: string | null;
  service?: string | null;
  packageName?: string | null;
  quote?: number | null;
  advance?: number | null;
  balance: number;
  upiId?: string | null;
  upiQrUrl?: string | null;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  purpose?: "ADVANCE" | "BALANCE";
}) {
  const pay = [];
  if (input.upiId) pay.push(`UPI: ${input.upiId}`);
  if (input.upiQrUrl) pay.push(`Scan QR: ${input.upiQrUrl}`);
  if (input.bankAccountNumber) {
    pay.push(
      `Bank Transfer:\n  ${input.bankAccountName ?? COMPANY.name}\n  A/C ${input.bankAccountNumber}` +
        (input.bankIfsc ? `\n  IFSC ${input.bankIfsc}` : "") +
        (input.bankName ? `\n  ${input.bankName}` : ""),
    );
  }
  const amountDue = input.purpose === "BALANCE" ? input.balance : (input.advance ?? input.balance);
  return [
    `${COMPANY.name} — Payment ${input.purpose === "BALANCE" ? "Request (Balance)" : "Request"}`,
    input.customerName ? `\nHi ${input.customerName},` : "",
    input.bookingId ? `Booking ID: ${input.bookingId}` : null,
    input.service ? `Service: ${input.service}${input.packageName ? ` – ${input.packageName}` : ""}` : null,
    input.quote != null ? `Quote: ${formatINR(input.quote)}` : null,
    input.advance != null ? `Advance: ${formatINR(input.advance)}` : null,
    `Balance: ${formatINR(input.balance)}`,
    ``,
    `Amount to pay now: ${formatINR(Math.max(amountDue, 0))}`,
    ``,
    pay.length ? `Pay via:\n${pay.join("\n")}` : `Our team will share payment details shortly.`,
    ``,
    `Please share the payment screenshot once done. Thank you!`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** WhatsApp payment receipt after a collection. */
export function paymentReceiptMessage(input: {
  customerName?: string | null;
  bookingId?: string | null;
  service?: string | null;
  amountPaid: number;
  mode?: string | null;
  balance: number;
}) {
  return [
    `${COMPANY.name} — Payment Receipt`,
    input.customerName ? `\nHi ${input.customerName},` : "",
    `We have received ${formatINR(input.amountPaid)}${input.mode ? ` via ${input.mode}` : ""}. ✅`,
    input.bookingId ? `Booking ID: ${input.bookingId}` : null,
    input.service ? `Service: ${input.service}` : null,
    input.balance > 0 ? `Balance remaining: ${formatINR(input.balance)}` : `Fully paid — thank you!`,
    ``,
    `— ${COMPANY.name}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function customerReminderMessage(input: { customerName: string; service: string; date: Date; timeSlot: string }) {
  return `Hi ${input.customerName}, this is a reminder that your ${input.service} with ${COMPANY.name} is scheduled for ${formatDate(
    input.date
  )} at ${input.timeSlot}. See you then! Call ${COMPANY.phones[0]} for any changes.`;
}

export function paymentReminderWhatsAppMessage(input: {
  clientName: string;
  invoiceNumber: string;
  balance: number;
  dueDate: Date;
}) {
  return `Hi ${input.clientName}, a friendly reminder that invoice ${input.invoiceNumber} of ${formatINR(
    input.balance
  )} is due on ${formatDate(input.dueDate)} — ${COMPANY.name}. Call ${COMPANY.phones[0]} for any queries.`;
}

export function reviewRequestMessage(input: {
  customerName: string;
  service: string;
  googleReviewUrl: string | null;
  jobNumber: string;
}) {
  const link = input.googleReviewUrl
    ? `\n\nPlease share a quick Google review — it really helps us: ${input.googleReviewUrl}`
    : "";
  return `Hi ${input.customerName}, thank you for choosing ${COMPANY.name} for your ${input.service}! We hope you're happy with the work. See your before/after photos + refer & earn code here: https://app.saharacleaningservices.com/j/${input.jobNumber}${link}\n\nCall us on ${COMPANY.phones[0]} for anything you need.`;
}

/** Day-3 gentle nudge in the review sequence (stops once a review is received). */
export function reviewReminderMessage(input: { customerName: string; googleReviewUrl: string | null }) {
  const link = input.googleReviewUrl
    ? ` ${input.googleReviewUrl}`
    : "";
  return [
    `Hi ${input.customerName}, hope everything's been great since your ${COMPANY.name} service! 🌟`,
    ``,
    `If you have 30 seconds, a quick Google review would mean a lot to our team:${link}`,
    ``,
    `Thank you! — ${COMPANY.name}. Call ${COMPANY.phones[0]} if anything needs attention.`,
  ].join("\n");
}

export function bookingFormMessage(input: { customerName: string; url: string }) {
  return [
    `Hi ${input.customerName}, book your cleaning service with ${COMPANY.name} in a few taps 👇`,
    ``,
    input.url,
    ``,
    `Your name & number are already filled in — just pick the service, date and time.`,
    `Questions? Call/WhatsApp ${COMPANY.phones[0]}.`,
  ].join("\n");
}

export function galleryShareMessage(input: { customerName: string }) {
  return [
    `Hi ${input.customerName}, take a look at our recent work at ${COMPANY.name} — before & after photos and videos 👇`,
    ``,
    GALLERY_PUBLIC_URL,
    ``,
    `Like what you see? Call/WhatsApp ${COMPANY.phones[0]} to book your service.`,
  ].join("\n");
}

export function paymentOptionsMessage(input: { customerName: string; upiId?: string | null; upiQrUrl?: string | null; bankName?: string | null; bankAccountName?: string | null; bankAccountNumber?: string | null; bankIfsc?: string | null }) {
  const pay: string[] = [];
  if (input.upiId) pay.push(`UPI: ${input.upiId}`);
  if (input.upiQrUrl) pay.push(`Scan QR: ${input.upiQrUrl}`);
  if (input.bankAccountNumber) {
    pay.push(
      `Bank Transfer:\n  ${input.bankAccountName ?? COMPANY.name}\n  A/C ${input.bankAccountNumber}` +
        (input.bankIfsc ? `\n  IFSC ${input.bankIfsc}` : "") +
        (input.bankName ? `\n  ${input.bankName}` : ""),
    );
  }
  return [
    `Hi ${input.customerName}, here are the payment options for ${COMPANY.name}:`,
    ``,
    pay.length ? pay.join("\n") : `Our team will share the exact amount and payment details shortly.`,
    ``,
    `Please share the payment screenshot once done. Call ${COMPANY.phones[0]} for any help.`,
  ].join("\n");
}

export function followUpNudgeMessage(input: { customerName: string; url: string }) {
  return [
    `Hi ${input.customerName}, just following up on your cleaning enquiry with ${COMPANY.name}.`,
    ``,
    `You can confirm your booking here: ${input.url}`,
    ``,
    `Or reply here and our team will help you directly.`,
  ].join("\n");
}

export function amcRenewalMessage(input: { customerName: string; nextVisitDate: Date; frequency: string }) {
  return `Hi ${input.customerName}, your ${COMPANY.name} AMC (${input.frequency.toLowerCase()}) visit is due on ${formatDate(
    input.nextVisitDate
  )}. Reply here or call ${COMPANY.phones[0]} to confirm a convenient time.`;
}

export function deviceApprovalRequestMessage(input: {
  userName: string;
  deviceLabel: string;
  otpCode: string;
}) {
  return [
    `🔐 New device login request`,
    ``,
    `${input.userName} is signing in to Sahara OS from a new device:`,
    `${input.deviceLabel}`,
    ``,
    `Code: ${input.otpCode}`,
    ``,
    `Approve or deny in the app: Settings → Device Approvals. If this wasn't ${input.userName}, deny it.`,
  ].join("\n");
}

export function dailyAttendanceSummaryMessage(input: { date: Date; present: number; absent: number; halfDay: number; total: number }) {
  return [
    `📊 Attendance Summary — ${formatDate(input.date)}`,
    `Present: ${input.present}`,
    `Half Day: ${input.halfDay}`,
    `Absent: ${input.absent}`,
    `Total Staff: ${input.total}`,
  ].join("\n");
}

/** Yesterday's business snapshot — sent each morning alongside the attendance summary. */
export function dailyBusinessSummaryMessage(input: {
  date: Date;
  jobsScheduled: number;
  jobsCompleted: number;
  newEnquiries: number;
  convertedLeads: number;
  followUpsPending: number;
  paymentsReceived: number;
  pendingPaymentsTotal: number;
  reviewsReceived: number;
  quotationsPending: number;
}) {
  return [
    `📈 Daily Business Summary — ${formatDate(input.date)}`,
    ``,
    `Jobs Scheduled: ${input.jobsScheduled}`,
    `Jobs Completed: ${input.jobsCompleted}`,
    `New Enquiries: ${input.newEnquiries}`,
    `Converted Leads: ${input.convertedLeads}`,
    `Follow-ups Pending Today: ${input.followUpsPending}`,
    ``,
    `Payments Received: ${formatINR(input.paymentsReceived)}`,
    `Pending Collection: ${formatINR(input.pendingPaymentsTotal)}`,
    `Quotations Awaiting Follow-up: ${input.quotationsPending}`,
    `Reviews Received: ${input.reviewsReceived}`,
    ``,
    `— ${COMPANY.name}`,
  ].join("\n");
}

// ── Staff self-notifications (Phase 6) — queued until the WhatsApp API is live.

const STATUS_WORD: Record<string, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  LEAVE: "Leave",
  WEEKLY_OFF: "Weekly Off",
};

export function staffAttendanceMessage(input: {
  name: string;
  date: Date;
  status: string;
  workingDays: number;
  advance: number;
  runningSalary: number;
  balance?: number;
}) {
  const hour = input.date.getHours();
  const greet = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const balance = input.balance ?? Math.max(input.runningSalary - input.advance, 0);
  return [
    `${greet} ${input.name} 🙏`,
    `${COMPANY.name}`,
    ``,
    `📅 ${formatDate(input.date)}`,
    `Attendance: ${STATUS_WORD[input.status] ?? input.status}`,
    `Total Working Days: ${input.workingDays}`,
    ``,
    `💰 Earned Salary: ${formatINR(input.runningSalary)}`,
    `➖ Advance Taken: ${formatINR(input.advance)}`,
    `✅ Current Balance: ${formatINR(balance)}`,
    ``,
    `For any query, contact the office: ${COMPANY.phones[0]}`,
  ].join("\n");
}

export function staffAdvanceMessage(input: { name: string; amount: number; advanceTotal: number; runningSalary: number }) {
  return [
    `${input.name}, an advance of ${formatINR(input.amount)} has been recorded.`,
    ``,
    `Total Advance this month: ${formatINR(input.advanceTotal)}`,
    `Current Salary Running: ${formatINR(input.runningSalary)}`,
    ``,
    `— ${COMPANY.name}`,
  ].join("\n");
}

export function staffSalarySlipMessage(input: { name: string; monthLabel: string; workingDays: number; advance: number; finalSalary: number }) {
  return [
    `${input.name}, your salary slip for ${input.monthLabel} is ready.`,
    ``,
    `Working Days: ${input.workingDays}`,
    `Advance: ${formatINR(input.advance)}`,
    `Final Salary: ${formatINR(input.finalSalary)}`,
    ``,
    `— ${COMPANY.name}`,
  ].join("\n");
}
