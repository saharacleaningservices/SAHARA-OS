// Staff App self-registration (2026-10-13) — server-only helpers; the public
// actions live in src/server/actions/staff-registration.ts.
//
// Only a mobile number that is on an ACTIVE staff record with NO app login yet
// can register. A staff member whose login exists (active or disabled) never
// gets a second one this way — disabled staff stay locked out, and existing
// staff use normal sign-in / Forgot PIN. Pending requests reuse SecurityOtp
// (purpose STAFF_REGISTRATION; targetUserId = Staff.id because no User exists
// yet; payload = the bcrypt hash of the password the staff member chose).

import { db } from "@/lib/db";

export const REG_OTP_PURPOSE = "STAFF_REGISTER_OTP";
export const REG_REQUEST_PURPOSE = "STAFF_REGISTRATION";

const last10 = (v: string) => v.replace(/\D/g, "").slice(-10);

export type EligibleStaff = { id: string; name: string; employeeCode: string; digits: string };

/** The staff record this mobile may register for, or null (unknown, disabled, already has a login, or ambiguous). */
export async function findRegistrableStaff(mobile: string): Promise<EligibleStaff | null> {
  const digits = last10(mobile);
  if (digits.length !== 10) return null;
  // Stored numbers may carry spaces / +91, so compare normalised digits (staff table is small).
  const candidates = await db.staff.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, employeeCode: true, mobile: true, isActive: true, isDemo: true, userId: true },
  });
  const matches = candidates.filter((s) => last10(s.mobile) === digits);
  if (matches.length !== 1) return null;
  const s = matches[0];
  if (!s.isActive || s.isDemo || s.userId) return null;
  // Any existing login on this number (any role, active or disabled) → the office handles it.
  const phoneOwner = await db.user.findFirst({ where: { phone: digits }, select: { id: true } });
  if (phoneOwner) return null;
  return { id: s.id, name: s.name, employeeCode: s.employeeCode, digits };
}

/** Create the STAFF login for an eligible staff record with an already-hashed password. */
export async function createStaffLogin(staff: EligibleStaff, passwordHash: string) {
  const email = `${staff.employeeCode.toLowerCase()}@staff.sahara.invalid`;
  const clash = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (clash) return { error: "A login for this Staff ID already exists — check User Management" } as const;
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { name: staff.name, email, phone: staff.digits, role: "STAFF", passwordHash, mustChangePassword: false },
    });
    // Guarded link: fails if a login was attached to this staff record in the meantime.
    const linked = await tx.staff.updateMany({ where: { id: staff.id, userId: null }, data: { userId: u.id } });
    if (linked.count !== 1) throw new Error("Staff record already has a login");
    return u;
  });
  return { userId: user.id } as const;
}

/** Open self-registration requests awaiting approval (callers gate by role). */
export async function listOpenStaffRegistrations() {
  const rows = await db.securityOtp.findMany({
    where: { purpose: REG_REQUEST_PURPOSE, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true, targetUserId: true, targetUserName: true },
  });
  if (rows.length === 0) return [];
  const staff = await db.staff.findMany({ where: { id: { in: rows.map((r) => r.targetUserId) } }, select: { id: true, name: true, employeeCode: true, mobile: true } });
  return rows.map((r) => {
    const s = staff.find((x) => x.id === r.targetUserId);
    return { id: r.id, createdAt: r.createdAt, expiresAt: r.expiresAt, staffId: s?.id ?? null, name: s?.name ?? r.targetUserName, employeeCode: s?.employeeCode ?? "", mobile: s ? last10(s.mobile) : "" };
  });
}

export async function getPendingStaffRegistration(staffId: string) {
  return db.securityOtp.findFirst({
    where: { purpose: REG_REQUEST_PURPOSE, targetUserId: staffId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true },
  });
}

