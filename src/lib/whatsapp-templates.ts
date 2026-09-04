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
  area: string;
  mapLink: string | null;
  service: string;
  date: Date;
  timeSlot: string;
  vehicle: string | null;
  materials: string[];
}) {
  // Customer phone number is deliberately never included.
  const lines = [
    `📋 Job Dispatch — ${formatDate(input.date)}`,
    ``,
    `Customer: ${input.customerName}`,
    `Area: ${input.area}`,
    input.mapLink ? `Map: ${input.mapLink}` : null,
    `Service: ${input.service}`,
    `Time: ${input.timeSlot}`,
    `Vehicle: ${input.vehicle ?? "Not assigned yet"}`,
    input.materials.length ? `Material: ${input.materials.join(", ")}` : `Material: —`,
    ``,
    `— ${COMPANY.name}`,
  ].filter(Boolean) as string[];
  return lines.join("\n");
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
