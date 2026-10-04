"use server";

// Staff App "Forgot PIN" (owner rule 2026-10-04): the staff member enters
// their registered mobile number (their login) + the new PIN they want; it
// takes effect only after Super Admin or Accounts approves it in the CRM
// (Staff → staff record → Staff App access). Reuses the SecurityOtp table
// (purpose STAFF_PIN_RESET; payload = pending bcrypt hash; codePlain records
// the decision) — no new table, no SMS/WhatsApp cost. The public request
// never reveals whether the mobile number matched an account.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { staffPinSchema } from "@/lib/validation";
import { notify } from "@/server/notify";

const PURPOSE = "STAFF_PIN_RESET";
const TTL_HOURS = 48;

const requestSchema = z
  .object({
    mobile: z.string().trim().min(10, "Enter your 10-digit mobile number").max(15),
    newPin: staffPinSchema,
    confirmPin: z.string().min(1, "Enter the new PIN again"),
  })
  .refine((v) => v.newPin === v.confirmPin, { message: "PINs do not match", path: ["confirmPin"] });

export async function requestStaffPinReset(values: unknown) {
  const ip = clientIp(await headers());
  if (!rateLimit(`staffreset:ip:${ip}`, 5, 600).allowed) return { error: "Too many requests. Try again in a few minutes." };

  const parsed = requestSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const { mobile, newPin } = parsed.data;
  const digits = mobile.replace(/\D/g, "").slice(-10);
  const generic = { success: true as const, message: "Your request has been sent to the office. They will approve it soon." };
  if (digits.length !== 10) return { error: "Enter your 10-digit mobile number" };
  if (!rateLimit(`staffreset:acct:${digits}`, 3, 3600).allowed) return generic;

  // Same identity the login uses: the User's mobile number.
  const user = await db.user.findFirst({
    where: { phone: digits, role: "STAFF", isActive: true },
    select: { id: true, email: true, staffProfile: { select: { id: true, name: true, employeeCode: true, deletedAt: true } } },
  });
  const staff = user?.staffProfile && !user.staffProfile.deletedAt ? { ...user.staffProfile, user } : null;
  if (!staff) return generic;

  // One open request per staff member — a newer request supersedes the older one.
  await db.securityOtp.updateMany({
    where: { purpose: PURPOSE, targetUserId: staff.user.id, consumedAt: null },
    data: { consumedAt: new Date(), codePlain: "SUPERSEDED", payload: null },
  });
  const req = await db.securityOtp.create({
    data: {
      purpose: PURPOSE,
      targetUserId: staff.user.id,
      targetUserName: staff.name,
      targetUserEmail: staff.user.email,
      codeHash: "-", // no code — approval happens in the CRM
      payload: await hashPassword(newPin),
      expiresAt: new Date(Date.now() + TTL_HOURS * 3600 * 1000),
      requestedByName: `${staff.name} (Staff App, ${ip})`,
    },
  });
  await db.auditLog
    .create({
      data: {
        entityType: "Security",
        entityId: req.id,
        action: "STAFF_PIN_RESET_REQUESTED",
        summary: `${staff.name} (${staff.employeeCode}) requested a Staff App PIN reset from ${ip}`,
        actorName: staff.name,
      },
    })
    .catch(() => {});
  await notify({
    kind: "STAFF_PIN_RESET",
    title: `PIN reset request — ${staff.name}`,
    body: `${staff.employeeCode} asked to reset their Staff App PIN. Call them to confirm, then approve or reject.`,
    href: `/staff/${staff.id}`,
  });
  return generic;
}

function canApprove(role?: string) {
  return role === "ADMIN" || role === "ACCOUNTS";
}

export async function decideStaffPinReset(requestId: string, approve: boolean) {
  const session = await getSession();
  if (!session || !canApprove(session.role)) return { error: "Only Super Admin or Accounts can approve PIN resets" };
  const req = await db.securityOtp.findUnique({ where: { id: requestId } });
  if (!req || req.purpose !== PURPOSE || req.consumedAt) return { error: "This request is no longer open" };
  if (req.expiresAt < new Date()) return { error: "This request has expired — ask the staff member to request again" };

  const target = await db.user.findUnique({ where: { id: req.targetUserId }, select: { id: true, role: true, staffProfile: { select: { id: true } } } });
  if (!target || target.role !== "STAFF") return { error: "Account not found" };

  if (approve && req.payload) {
    await db.user.update({ where: { id: target.id }, data: { passwordHash: req.payload, mustChangePassword: false } });
  }
  await db.securityOtp.update({
    where: { id: req.id },
    data: { consumedAt: new Date(), payload: null, codePlain: `${approve ? "APPROVED" : "REJECTED"} by ${session.name}` },
  });
  await db.auditLog
    .create({
      data: {
        entityType: "Security",
        entityId: req.id,
        action: approve ? "STAFF_PIN_RESET_APPROVED" : "STAFF_PIN_RESET_REJECTED",
        summary: `Staff App PIN reset for ${req.targetUserName} ${approve ? "approved" : "rejected"} by ${session.name}`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});
  if (target.staffProfile) revalidatePath(`/staff/${target.staffProfile.id}`);
  return { success: true as const };
}
