import { db } from "@/lib/db";

/** Open Staff App PIN-reset request for a user (server-only; callers gate by role). */
export async function getPendingStaffPinReset(userId: string) {
  return db.securityOtp.findFirst({
    where: { purpose: "STAFF_PIN_RESET", targetUserId: userId, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true },
  });
}
