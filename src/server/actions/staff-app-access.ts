"use server";

// Staff App logins — created from the Staff detail page by the Super Admin
// (User Management stays owner-only). Reuses the existing User/STAFF role,
// bcrypt hashing, mustChangePassword → /set-password, and isActive checks;
// no second auth system. The staff member signs in with their Staff ID
// registered mobile number + a simple 4-digit PIN (owner rule 2026-10-04).
// Every staff member gets their own initial PIN — never one common PIN; it is
// returned ONCE in the response for the office to hand over, and only its
// bcrypt hash is stored. Staff may change it themselves after login.

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession, revokeUserSessions } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getPendingStaffPinReset } from "@/server/staff-pin-reset";
import { getPendingStaffRegistration } from "@/server/staff-registration";

// Super Admin, and Accounts (Shoyab Kazi) — owner-authorised 2026-10-13 to manage
// Staff App access: create logins, Reset PIN, enable/disable.
async function requireOwner() {
  const session = await getSession();
  return session?.role === "ADMIN" || session?.role === "ACCOUNTS" ? session : null;
}

// Same digit x4, simple runs, and year-like PINs (19xx / 20xx) are easy to guess.
const WEAK = /^(\d)\1{3}$|^(1234|2345|3456|4567|5678|6789|4321|1212|0123)$|^(19|20)\d\d$/;

/**
 * A 4-digit initial PIN that no other staff member still on their initial
 * PIN shares (checked against those bcrypt hashes) and that isn't an obvious
 * pattern. The check only covers logins still on an initial PIN — the only
 * ones the office ever hands out.
 */
async function uniqueInitialPin(excludeUserId?: string) {
  const onInitial = await db.user.findMany({
    where: { role: "STAFF", mustChangePassword: true, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { passwordHash: true },
  });
  for (let attempt = 0; attempt < 40; attempt++) {
    const pin = String(randomInt(1000, 10000));
    if (WEAK.test(pin)) continue;
    let clash = false;
    for (const u of onInitial) {
      if (await verifyPassword(pin, u.passwordHash)) {
        clash = true;
        break;
      }
    }
    if (!clash) return pin;
  }
  throw new Error("Could not generate a unique PIN — try again");
}

async function audit(session: { name: string; email: string }, entityId: string, action: string, summary: string) {
  await db.auditLog
    .create({ data: { entityType: "User", entityId, action, summary, actorName: session.name, actorEmail: session.email } })
    .catch(() => {});
}

export async function getStaffAppAccess(staffId: string) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "ACCOUNTS")) return null;
  const staff = await db.staff.findUnique({
    where: { id: staffId },
    select: { employeeCode: true, user: { select: { id: true, isActive: true, role: true, mustChangePassword: true, phone: true } } },
  });
  if (!staff) return null;
  const lastLogin = staff.user
    ? await db.auditLog.findFirst({
        where: { entityType: "Login", entityId: staff.user.id, action: "LOGIN_SUCCESS" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      })
    : null;
  const pendingReset = staff.user ? await getPendingStaffPinReset(staff.user.id) : null;
  const pendingRegistration = staff.user ? null : await getPendingStaffRegistration(staffId);
  return {
    pendingReset,
    pendingRegistration,
    employeeCode: staff.employeeCode,
    hasLogin: Boolean(staff.user),
    isActive: staff.user?.isActive ?? false,
    role: staff.user?.role ?? null,
    pendingFirstLogin: staff.user?.mustChangePassword ?? false,
    loginMobile: staff.user?.phone ?? null,
    lastLoginAt: lastLogin?.createdAt ?? null,
  };
}

export async function enableStaffAppLogin(staffId: string) {
  const session = await requireOwner();
  if (!session) return { error: "Only Super Admin or Accounts can create Staff App logins" };

  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff || staff.deletedAt) return { error: "Staff not found" };
  if (staff.userId) return { error: "This staff member already has a login — use Reset PIN" };

  const mobile = staff.mobile.replace(/\D/g, "").slice(-10);
  if (mobile.length !== 10) return { error: "Add a valid 10-digit mobile number to this staff record first" };

  const pin = await uniqueInitialPin();
  const phoneOwner = await db.user.findFirst({ where: { phone: mobile }, include: { staffProfile: { select: { id: true } } } });

  let userId: string;
  if (phoneOwner) {
    // Reuse an existing STAFF account with this number only if it isn't linked elsewhere.
    if (phoneOwner.role !== "STAFF" || phoneOwner.staffProfile) {
      return { error: "Another login already uses this mobile number. Change it in User Management first." };
    }
    await db.user.update({
      where: { id: phoneOwner.id },
      data: { passwordHash: await hashPassword(pin), mustChangePassword: true, isActive: true, name: staff.name },
    });
    userId = phoneOwner.id;
  } else {
    const email = `${staff.employeeCode.toLowerCase()}@staff.sahara.invalid`;
    const clash = await db.user.findUnique({ where: { email } });
    if (clash) return { error: "A login for this Staff ID already exists — check User Management" };
    const user = await db.user.create({
      data: {
        name: staff.name,
        email,
        phone: mobile,
        role: "STAFF",
        passwordHash: await hashPassword(pin),
        mustChangePassword: true,
      },
    });
    userId = user.id;
  }
  await db.staff.update({ where: { id: staffId }, data: { userId } });
  await audit(session, userId, "STAFF_APP_LOGIN_CREATED", `Staff App login enabled for ${staff.name} (${staff.employeeCode}) — temporary PIN issued`);

  revalidatePath(`/staff/${staffId}`);
  return { success: true as const, mobile, tempPin: pin };
}

export async function resetStaffAppPin(staffId: string) {
  const session = await requireOwner();
  if (!session) return { error: "Only Super Admin or Accounts can reset a PIN" };
  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { name: true, employeeCode: true, userId: true } });
  if (!staff?.userId) return { error: "No Staff App login yet" };
  const pin = await uniqueInitialPin(staff.userId);
  await db.user.update({ where: { id: staff.userId }, data: { passwordHash: await hashPassword(pin), mustChangePassword: true } });
  await revokeUserSessions(staff.userId); // the old PIN's sessions end on every device
  await audit(session, staff.userId, "STAFF_APP_PIN_RESET", `Staff App PIN reset for ${staff.name} (${staff.employeeCode}) — temporary PIN issued`);
  revalidatePath(`/staff/${staffId}`);
  return { success: true as const, tempPin: pin };
}

export async function setStaffAppLoginActive(staffId: string, isActive: boolean) {
  // Super Admin or Accounts (2026-10-13: Accounts may control staff access).
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "ACCOUNTS")) return { error: "Only Super Admin or Accounts can change Staff App access" };
  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { name: true, employeeCode: true, userId: true, user: { select: { role: true } } } });
  if (!staff?.userId) return { error: "No Staff App login yet" };
  if (staff.user?.role !== "STAFF") return { error: "This login isn't a Staff App account — manage it in User Management" };
  await db.user.update({ where: { id: staff.userId }, data: { isActive } });
  if (!isActive) {
    await db.pushSubscription.deleteMany({ where: { userId: staff.userId } });
    await revokeUserSessions(staff.userId); // signed out on every device immediately
  }
  await audit(
    session,
    staff.userId,
    isActive ? "STAFF_APP_LOGIN_ENABLED" : "STAFF_APP_LOGIN_DISABLED",
    `Staff App login ${isActive ? "enabled" : "disabled"} for ${staff.name} (${staff.employeeCode})`,
  );
  revalidatePath(`/staff/${staffId}`);
  return { success: true as const };
}
