import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { DEVICE_GATED_ROLES, finishLogin } from "@/server/login-session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getDeviceToken, setDeviceCookie, generateDeviceToken, generateOtp, labelFromUserAgent } from "@/lib/device";
import { sendWhatsApp } from "@/lib/whatsapp";
import { deviceApprovalRequestMessage } from "@/lib/whatsapp-templates";
import { notify } from "@/server/notify";

// Accepts a mobile number OR an email as the login ID.
const loginSchema = z.object({
  loginId: z.string().trim().min(3).max(120),
  password: z.string().min(1),
});

// DEVICE_GATED_ROLES (Operations, Accounts, Supervisor need the owner to approve each new device): server/login-session.ts
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
    return NextResponse.json({ error: "Enter your mobile number (or email) and password." }, { status: 400 });
  }

  const { loginId, password } = parsed.data;
  // Trim the identifier only — a login ID never has meaningful leading/
  // trailing whitespace, but autofill/copy-paste can add it, which would
  // otherwise make a correct email fail its exact-match lookup below. The
  // password itself is never trimmed: it's compared exactly as typed.
  const id = loginId.trim().toLowerCase();
  const digits = loginId.replace(/\D/g, "");

  const accountLimit = rateLimit(`login:acct:${id}`, 5, 600);
  if (!accountLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts for this account. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(accountLimit.retryAfterSeconds) } }
    );
  }

  // Look up by email or by mobile number (last 10 digits, to tolerate a
  // leading 0 / +91 the user might type).
  const user = id.includes("@")
    ? await db.user.findUnique({ where: { email: id } })
    : digits.length >= 10
      ? await db.user.findFirst({ where: { phone: digits.slice(-10) } })
      : null;

  if (!user || !user.isActive) {
    // No persistent login-history trail existed for this path before the
    // 2026-09-21 security audit — a wrong/unknown loginId left zero trace
    // anywhere, unlike a wrong password for a real account (which already
    // triggered notify() below, just not an AuditLog row either). Logged
    // without the submitted loginId's raw value beyond what's already
    // partially visible in `entityId`, and never the password.
    await db.auditLog
      .create({
        data: {
          entityType: "Login",
          entityId: id,
          action: "LOGIN_FAILED",
          summary: `Login failed — no active account for "${id}" from ${labelFromUserAgent(request.headers.get("user-agent"))} · ${ip}`,
        },
      })
      .catch(() => {});
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await db.auditLog
      .create({
        data: {
          entityType: "Login",
          entityId: user.id,
          action: "LOGIN_FAILED",
          summary: `Wrong password for ${user.name} (${user.phone ?? user.email}) from ${labelFromUserAgent(request.headers.get("user-agent"))} · ${ip}`,
          actorName: user.name,
          actorEmail: user.email,
        },
      })
      .catch(() => {});
    // Security alert to the Super Admin on a failed login for a real account.
    await notify({
      kind: "LOGIN_ATTEMPT",
      title: "Failed login attempt",
      body: `Wrong password for ${user.name} (${user.phone ?? user.email}) from ${labelFromUserAgent(request.headers.get("user-agent"))} · ${ip}`,
      href: "/admin/security-approvals",
    });
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

      // Instant alert to the Super Admin (in-app + push + WhatsApp).
      await notify({
        kind: "DEVICE_LOGIN",
        title: "New device login needs approval",
        body: `${user.name} (${user.email}) is trying to sign in from ${label}. OTP: ${otpCode}`,
        href: "/admin/device-approvals",
        whatsappToAdmin: false,
        meta: { deviceId: device.id, ip },
      });

      return NextResponse.json({ pending: true, deviceToken: token });
    }
  }

  // Session, audit trail and owner alert — shared with biometric sign-in (server/login-session.ts).
  await finishLogin(user, request, "password");

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role, email: user.email },
  });
}
