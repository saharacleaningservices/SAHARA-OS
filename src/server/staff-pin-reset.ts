import { db } from "@/lib/db";

/** Open Staff App PIN-reset request for a user (server-only; callers gate by role). */
export async function getPendingStaffPinReset(userId: string) {
  return db.securityOtp.findFirst({
    where: { purpose: "STAFF_PIN_RESET", targetUserId: userId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true },
  });
}

/** All open Staff App PIN-reset requests (Password Reset Requests list; callers gate by role). */
export async function listOpenStaffPinResets() {
  const rows = await db.securityOtp.findMany({
    where: { purpose: "STAFF_PIN_RESET", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true, targetUserId: true, targetUserName: true },
  });
  if (rows.length === 0) return [];
  const staff = await db.staff.findMany({ where: { userId: { in: rows.map((r) => r.targetUserId) } }, select: { id: true, userId: true, employeeCode: true, name: true } });
  return rows.map((r) => {
    const s = staff.find((x) => x.userId === r.targetUserId);
    return { id: r.id, createdAt: r.createdAt, expiresAt: r.expiresAt, name: s?.name ?? r.targetUserName ?? "—", employeeCode: s?.employeeCode ?? "", staffId: s?.id ?? null };
  });
}
