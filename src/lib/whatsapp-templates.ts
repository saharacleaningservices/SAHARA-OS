// Deterministic WhatsApp message text for every Phase 3 automation. Kept
// separate from src/lib/whatsapp.ts (the transport) so the wording can be
// edited without touching send/queue logic — mirrors the existing
// src/lib/ai/quotation.ts + payment-reminder.ts pattern.
import { COMPANY } from "@/lib/constants";
import { formatINR, formatDate } from "@/lib/utils";

export function bookingConfirmationMessage(input: {
  customerName: string;
  service: string;
  area: string;
  date: Date;
  timeSlot: string;
  jobNumber: string;
}) {
  return [
    `Hi ${input.customerName}, your booking with ${COMPANY.name} is confirmed! ✅`,
    ``,
    `Service: ${input.service}`,
    `Location: ${input.area}`,
    `Date: ${formatDate(input.date)} at ${input.timeSlot}`,
    `Booking ref: ${input.jobNumber}`,
    `Track it here: https://app.saharacleaningservices.com/j/${input.jobNumber}`,
    ``,
    `Our team will reach you on time. Call us on ${COMPANY.phones[0]} for any changes.`,
  ].join("\n");
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
