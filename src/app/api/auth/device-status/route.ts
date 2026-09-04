import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { getDeviceToken } from "@/lib/device";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Polled by the login page every few seconds while a device waits for
// Altaf's approval. Once approved, this is what actually issues the
// session — the original login request never set a session cookie, only
// this endpoint does, and only once Device.status is APPROVED.
export async function GET(request: NextRequest) {
  const limit = rateLimit(`device-status:${clientIp(request.headers)}`, 60, 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const token = await getDeviceToken();
  if (!token) return NextResponse.json({ error: "No pending device" }, { status: 400 });

  const device = await db.device.findFirst({ where: { token }, include: { user: true } });
  if (!device) return NextResponse.json({ error: "No pending device" }, { status: 400 });

  if (device.status === "DENIED") {
    return NextResponse.json({ denied: true });
  }

  if (device.status === "PENDING") {
    if (device.otpExpiresAt && device.otpExpiresAt < new Date()) {
      return NextResponse.json({ expired: true });
    }
    return NextResponse.json({ pending: true });
  }

  // APPROVED — issue the real session now.
  const sessionToken = await createSessionToken({
    sub: device.user.id,
    name: device.user.name,
    email: device.user.email,
    role: device.user.role,
    avatarUrl: device.user.avatarUrl,
    deviceId: device.token,
  });
  await setSessionCookie(sessionToken);
  await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

  return NextResponse.json({
    approved: true,
    user: { id: device.user.id, name: device.user.name, role: device.user.role, email: device.user.email },
  });
}
