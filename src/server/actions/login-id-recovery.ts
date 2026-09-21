"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { forgotLoginIdSchema } from "@/lib/validation";
import { notify } from "@/server/notify";

/**
 * "Forgot Login ID?" — for a user who remembers their name but not which
 * mobile number / email they registered with (the login ID here IS the
 * mobile number or email, there's no separate username field). No session
 * required.
 *
 * Never reveals whether a name matches an account, and never sends the
 * actual mobile/email back to the browser — same human-verified pattern as
 * password reset: only the Super Admin is told the real value, over the
 * existing notify() channel (in-app + push + WhatsApp, whichever is
 * connected), and relays it to the requester directly. This also means no
 * new SMS/WhatsApp provider is needed — it reuses the same queued delivery
 * already in place for password-reset OTPs.
 */
export async function requestLoginIdRecovery(values: unknown) {
  const hdrs = await headers();
  const ip = clientIp(hdrs);

  const ipLimit = rateLimit(`loginid:ip:${ip}`, 5, 600);
  if (!ipLimit.allowed) {
    return { error: "Too many requests. Try again in a few minutes." };
  }

  const parsed = forgotLoginIdSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { name } = parsed.data;

  const acctLimit = rateLimit(`loginid:name:${name.toLowerCase()}`, 3, 600);
  if (!acctLimit.allowed) {
    return { error: "Too many requests for this name. Try again in a few minutes." };
  }

  // SQLite (this app's database) doesn't support Prisma's `mode:
  // "insensitive"` filter — do the case-insensitive match in JS instead. The
  // team is small enough that fetching active users is cheap.
  const activeUsers = await db.user.findMany({ where: { isActive: true }, select: { id: true, name: true, phone: true, email: true } });
  const user = activeUsers.find((u) => u.name.trim().toLowerCase() === name.toLowerCase());

  // Always the same response whether or not a match was found, so this form
  // never leaks which names have accounts. Only a real match notifies Altaf.
  if (user) {
    await notify({
      kind: "LOGIN_ID_RECOVERY",
      title: "Login ID recovery requested",
      body: `"${name}" asked to recover their login ID. On file: mobile ${user.phone ?? "—"}, email ${user.email}. Call them back to confirm it's really them before sharing it.`,
      href: "/admin/security-approvals",
      whatsappToAdmin: true,
      meta: { targetUserId: user.id },
    });
  }

  return { requested: true as const };
}
