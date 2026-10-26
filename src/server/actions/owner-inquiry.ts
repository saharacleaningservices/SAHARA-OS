"use server";

// Quick Add Inquiry (Super Admin only) + the new-inquiry alert popup for the team members it is routed to.
// Every call is authorized here, server-side — hiding the UI is not protection. Logic: src/server/owner-inquiry.ts.

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  acknowledgeInquiryAlert,
  createOwnerInquiry,
  listAssignees,
  listInquiryAlerts,
  getInquiryTracker,
  recordInquiryOutcome,
  type CreateInquiryInput,
  type OutcomeInput,
} from "@/server/owner-inquiry";

const ALERT_ROLES = ["ADMIN", "ACCOUNTS", "OPERATIONS"];

export async function getInquiryAssignees() {
  const s = await getSession();
  if (s?.role !== "ADMIN") return null;
  return listAssignees();
}

export async function quickAddInquiry(values: CreateInquiryInput) {
  const s = await getSession();
  if (s?.role !== "ADMIN") return { ok: false as const, error: "Only the Super Admin can add owner inquiries" };
  const res = await createOwnerInquiry({ id: s.sub, name: s.name, email: s.email, role: s.role }, values ?? { mobile: "" });
  if (res.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/leads");
  }
  return res;
}

/** Unread new-inquiry alerts for the signed-in user (polled by the popup; null for roles that never receive them). */
export async function getMyInquiryAlerts() {
  const s = await getSession();
  if (!s || !ALERT_ROLES.includes(s.role)) return null;
  return listInquiryAlerts({ id: s.sub, role: s.role });
}

export async function acknowledgeMyInquiryAlert(notificationId: string) {
  const s = await getSession();
  if (!s || !ALERT_ROLES.includes(s.role) || typeof notificationId !== "string") return { ok: false as const, error: "Not authorized" };
  return acknowledgeInquiryAlert({ id: s.sub, name: s.name, email: s.email }, notificationId);
}

/** One-click follow-up outcome (Accounts / Operations / Super Admin). Never changes stage, quotation, booking or payment. */
export async function recordMyInquiryOutcome(values: OutcomeInput) {
  const s = await getSession();
  if (!s || !ALERT_ROLES.includes(s.role)) return { ok: false as const, error: "Not authorized" };
  const res = await recordInquiryOutcome({ id: s.sub, name: s.name, email: s.email, role: s.role }, values ?? { leadId: "", outcome: "" });
  if (res.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/leads");
  }
  return res;
}

/** Super Admin only: owner-entered inquiries with who saw them and every recorded outcome. */
export async function getOwnerInquiryTracker() {
  const s = await getSession();
  if (s?.role !== "ADMIN") return null;
  return getInquiryTracker();
}
