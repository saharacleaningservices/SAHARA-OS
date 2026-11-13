import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { otpMatches, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { isSameOrigin } from "@/lib/csrf";

const schema = z.object({ challengeId: z.string().min(1), code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code.") });

// Second step of the staff login: exchanges a valid WhatsApp code for a session.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ip = clientIp(request.headers);
  const ipLimit = rateLimit(`login-otp:verify:${ip}`, 20, 600);
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter the 6-digit code." }, { status: 400 });
  }
  const { challengeId, code } = parsed.data;

  const challenge = await db.loginOtp.findUnique({ where: { id: challengeId } });
  const generic = { error: "That code is invalid or has expired. Sign in again to get a new one." };
  if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date() || challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json(generic, { status: 401 });
  }

  if (!otpMatches(code, `login:${challenge.id}`, challenge.codeHash)) {
    await db.loginOtp.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 401 });
  }

  // Single use: only the first request to flip consumedAt wins.
  const consumed = await db.loginOtp.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return NextResponse.json(generic, { status: 401 });

  const user = await db.user.findUnique({ where: { id: challenge.userId } });
  if (!user || !user.isActive) return NextResponse.json(generic, { status: 401 });

  await setSessionCookie(
    await createSessionToken({ sub: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl })
  );
  return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role, email: user.email } });
}
