import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export { SESSION_COOKIE };
// Enterprise-appropriate session timeout for a system holding real customer
// and financial data — was 7 days. Revocation (2026-10-13): every token
// carries the user's sessionVersion; getSession() rejects a token whose
// version is stale or whose account is disabled, so bumping
// User.sessionVersion (revokeUserSessions) signs that user out everywhere.
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set. Add it to your .env file.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: string; // user id
  name: string;
  email: string;
  role: "ADMIN" | "OPERATIONS" | "ACCOUNTS" | "SUPERVISOR" | "STAFF";
  avatarUrl?: string | null;
  deviceId?: string; // set only for roles gated by owner-controlled device login
  sv?: number; // User.sessionVersion at sign-in (absent on pre-2026-10-13 tokens = 0)
};

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const sv = payload.sv ?? (await db.user.findUnique({ where: { id: payload.sub }, select: { sessionVersion: true } }))?.sessionVersion ?? 0;
  return new SignJWT({ ...payload, sv })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Account still active and token not revoked (memoised per request). */
const isSessionCurrent = cache(async (userId: string, sv: number) => {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isActive: true, sessionVersion: true } });
  return Boolean(user?.isActive && user.sessionVersion === sv);
});

/** Server Component / Route Handler helper — reads & verifies the session cookie. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return (await isSessionCurrent(payload.sub, payload.sv ?? 0)) ? payload : null;
}

/** Sign a user out of every device (password reset, access disabled). */
export async function revokeUserSessions(userId: string) {
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
