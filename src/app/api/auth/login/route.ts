import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getDeviceToken, setDeviceCookie, generateDeviceToken, generateOtp, labelFromUserAgent } from "@/lib/device";
import { sendWhatsApp } from "@/lib/whatsapp";
import { deviceApprovalRequestMessage } from "@/lib/whatsapp-templates";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Roles that require the owner (Altaf) to approve every new device before a
// session is issued. Deliberately not ADMIN (Altaf approves himself by
// definition), not ACCOUNTS/STAFF (not in scope per the production
// hardening spec — only Operations Manager and Field Supervisor logins are
// gated).
const DEVICE_GATED_ROLES = new Set(["OPERATIONS", "SUPERVISOR"]);
const OTP_TTL_MINUTES = 15;

export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);

  // Rate limit by IP regardless of what's in the body (protects against a
  // flood of malformed requests too), then again by IP+email once parsed —
  // 10 attempts per 10 minutes per IP, 5 per 10 minutes per account.
  const ipLimit = rateLimit(`login:ip:${ip}`, 10, 600);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const emailLimit = rateLimit(`login:email:${email.toLowerCase()}`, 5, 600);
  if (!emailLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts for this account. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSeconds) } }
    );
  }

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  // Password is correct from here on — decide whether this device needs
  // the owner's approval before a session is actually issued.
  if (DEVICE_GATED_ROLES.has(user.role)) {
    const existingToken = await getDeviceToken();
    const existingDevice = existingToken
      ? await db.device.findFirst({ where: { token: existingToken, userId: user.id } })
      : null;

    if (existingDevice?.status === "APPROVED") {
      await db.device.update({ where: { id: existingDevice.id }, data: { lastSeenAt: new Date() } });
      // Fall through to normal session issuance below.
    } else if (existingDevice?.status === "PENDING") {
      // Already asked for this exact device — don't spam a new OTP/message.
      return NextResponse.json({ pending: true, deviceToken: existingDevice.token });
    } else {
      // Unknown device (no cookie, cookie from a different user, or a
      // previously denied device trying again) — always requires fresh
      // approval, per spec.
      const token = generateDeviceToken();
      const label = labelFromUserAgent(request.headers.get("user-agent"));
      const otpCode = generateOtp();
      const device = await db.device.create({
        data: {
          userId: user.id,
          token,
          label,
          ipAddress: ip,
          status: "PENDING",
          otpCode,
          otpExpiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
        },
      });
      await setDeviceCookie(token);

      await db.auditLog.create({
        data: {
          entityType: "Device",
          entityId: device.id,
          action: "LOGIN_APPROVAL_REQUESTED",
          summary: `${user.name} (${user.role}) requested login from a new device: ${label}`,
          actorName: user.name,
          actorEmail: user.email,
        },
      });

      const owner = await db.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" } });
      if (owner?.phone) {
        await sendWhatsApp({
          kind: "DEVICE_APPROVAL",
          toNumber: owner.phone,
          toName: owner.name,
          body: deviceApprovalRequestMessage({ userName: user.name, deviceLabel: label, otpCode }),
          relatedType: "Device",
          relatedId: device.id,
        }).catch(() => {});
      }

      return NextResponse.json({ pending: true, deviceToken: token });
    }
  }

  const token = await createSessionToken({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    ...(DEVICE_GATED_ROLES.has(user.role) ? { deviceId: (await getDeviceToken()) ?? undefined } : {}),
  });

  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role, email: user.email },
  });
}
