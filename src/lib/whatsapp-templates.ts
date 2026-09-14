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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Very small, deterministic parser for the fixed set of time-slot labels
 * used on the booking form (e.g. "8:00 – 11:00", "1:00 – 4:00", "Flexible").
 * Hours 1–7 with no AM/PM marker are afternoon slots (the service day runs
 * roughly 8 AM–6 PM), everything else (8–12) is taken as-is. Falls back to
 * a 9 AM–12 PM default for anything unrecognized.
 */
function parseServiceTimeSlot(slot: string | null | undefined): {
  startH: number;
  startM: number;
  endH: number;
  endM: number;
} {
  const fallback = { startH: 9, startM: 0, endH: 12, endM: 0 };
  if (!slot || slot.toLowerCase() === "flexible") return fallback;
  const parts = slot
    .split(/[–-]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length !== 2) return fallback;
  const parseOne = (s: string) => {
    const m = s.match(/(\d{1,2})(?::(\d{2}))?/);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (h >= 1 && h <= 7) h += 12;
    return { h, min };
  };
  const a = parseOne(parts[0]);
  const b = parseOne(parts[1]);
  if (!a || !b) return fallback;
  return { startH: a.h, startM: a.min, endH: b.h, endM: b.min };
}

/**
 * Builds a Google Calendar "add event" link for a scheduled service visit.
 * `date` is read with UTC getters (it originates from a plain "YYYY-MM-DD"
 * string, which JS parses as UTC midnight) so the emitted date is never
 * shifted by the server's local timezone; the emitted datetime string has
 * no trailing "Z", so Google Calendar renders it as a floating local time —
 * correct for the IST wall-clock hours the booking form already collects.
 */
function googleCalendarLink(input: {
  title: string;
  date: Date;
  timeSlot: string | null;
  location: string;
  details: string;
}) {
  const { startH, startM, endH, endM } = parseServiceTimeSlot(input.timeSlot);
  const y = input.date.getUTCFullYear();
  const mo = pad2(input.date.getUTCMonth() + 1);
  const d = pad2(input.date.getUTCDate());
  const start = `${y}${mo}${d}T${pad2(startH)}${pad2(startM)}00`;
  const end = `${y}${mo}${d}T${pad2(endH)}${pad2(endM)}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${start}/${end}`,
    details: input.details,
    location: input.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
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
 * Exactly three actions are shown — View Booking, Pay After Service, Add to
 * Calendar. The Google Review ask is intentionally NOT part of this message:
 * it is sent separately, only once the job's status becomes COMPLETED (see
 * premiumReviewRequestMessage below), so we never ask for a review before
 * the work is actually done.
 *
 * WhatsApp's Cloud API only supports more than 3 buttons, or any link-type
 * button (e.g. "View Booking Details" as a tappable link), inside a
 * pre-approved Meta message Template — not in a plain-text/ad-hoc message.
 * Until an approved template name is available, the three actions below are
 * rendered as clearly-labelled tappable links so the customer gets the same
 * information and the same destinations today. Once a Meta template is
 * approved, swap the sendWhatsApp() call in confirmBooking() for a
 * `type: "template"` send using these same three destinations (trackingUrl /
 * payment line / calendarUrl) as the template's button parameters — no other
 * change needed here.
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
}) {
  const trackingUrl = `https://app.saharacleaningservices.com/j/${input.jobNumber}`;
  const location = input.address?.trim() || input.area;
  const calendarUrl = googleCalendarLink({
    title: `${input.service} — ${COMPANY.name}`,
    date: input.date,
    timeSlot: input.timeSlot,
    location,
    details: `Booking ${input.jobNumber} with ${COMPANY.name}. Track: ${trackingUrl}`,
  });
  const paymentLine =
    input.balanceDue && input.balanceDue > 0
      ? `Pay After Service — ${formatINR(input.balanceDue)} due on completion`
      : `Pay After Service — fully settled, thank you!`;

  return [
    `✅ *Booking Confirmed — ${COMPANY.name}*`,
    ``,
    `Hi ${input.customerName}, your booking is confirmed!`,
    ``,
    `👤 Customer Name: ${input.customerName}`,
    `🆔 Booking ID: ${input.jobNumber}`,
    `🧹 Service: ${input.service}`,
    `🗓️ Date & Time: ${formatDate(input.date)}, ${input.timeSlot}`,
    `📍 Address: ${location}`,
    ``,
    `— — — — — — — — — —`,
    `📄 View Booking Details: ${trackingUrl}`,
    `💳 ${paymentLine}`,
    `📅 Add to Calendar: ${calendarUrl}`,
    `— — — — — — — — — —`,
    ``,
    `📞 ${COMPANY.phones[0]}`,
    `📱 ${COMPANY.phones[1]}`,
    `🌐 ${COMPANY.website ?? "www.saharacleaningservices.com"}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

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
