import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { getDeviceToken, labelFromUserAgent } from "@/lib/device";
import { clientIp } from "@/lib/rate-limit";
import { notify } from "@/server/notify";

// Roles that require the Super Admin (Altaf) to approve every new device before a session is issued —
// Operations, Accounts and the Field Coordinator (Supervisor). Not ADMIN, not plain STAFF.
export const DEVICE_GATED_ROLES = new Set(["OPERATIONS", "ACCOUNTS", "SUPERVISOR"]);

type LoginUser = { id: string; name: string; email: string; role: string; avatarUrl: string | null };

/**
 * Issues the session after a successful sign-in (password or biometric) — one place, so both methods
 * get the same token, audit trail and owner alert. Device approval must already have been checked.
 */
export async function finishLogin(user: LoginUser, request: NextRequest, method: "password" | "biometric" = "password") {
  const token = await createSessionToken({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role as "ADMIN" | "OPERATIONS" | "ACCOUNTS" | "SUPERVISOR" | "STAFF",
    avatarUrl: user.avatarUrl,
    ...(DEVICE_GATED_ROLES.has(user.role) ? { deviceId: (await getDeviceToken()) ?? undefined } : {}),
  });
  await setSessionCookie(token);

  const ip = clientIp(request.headers);
  const via = method === "biometric" ? " using biometrics" : "";
  // Persistent login-history trail (2026-09-21 security audit): every successful login is on /admin/audit-log.
  await db.auditLog
    .create({
      data: {
        entityType: "Login",
        entityId: user.id,
        action: "LOGIN_SUCCESS",
        summary: `${user.name} (${user.role}) signed in${via} from ${labelFromUserAgent(request.headers.get("user-agent"))} · ${ip}`,
        actorName: user.name,
        actorEmail: user.email,
      },
    })
    .catch(() => {});

  // Instant sign-in alert to the Super Admin for the gated office accounts.
  if (DEVICE_GATED_ROLES.has(user.role)) {
    await notify({
      kind: "LOGIN_ATTEMPT",
      title: `${user.name} signed in`,
      body: `${user.email} signed in${via} from ${labelFromUserAgent(request.headers.get("user-agent"))} (${ip}).`,
      href: "/admin/audit-log",
      whatsappToAdmin: false,
    });
  }
}
