import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

// Biometric / passkey sign-in (WebAuthn). Server-side helpers shared by /api/auth/webauthn/*.
//
// Security model:
// - The phone's Face ID / fingerprint / screen lock never leaves the device; we store only the public key.
// - Every ceremony uses a fresh random challenge kept in a short-lived, signed, httpOnly cookie that is
//   bound to its purpose (register / login / unlock) and deleted after one verification attempt.
// - A passkey replaces only the password. Account checks (active, session version) and the owner's
//   device approval for gated roles still apply — see the login verify route.

export const RP_NAME = "Sahara OS";
const CHALLENGE_COOKIE = "sahara_webauthn";
const CHALLENGE_TTL_SECONDS = 5 * 60;

export type Ceremony = "register" | "login" | "unlock";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(s);
}

/**
 * Relying party = the host the browser is on (crm.saharacleaningservices.com in production, localhost in dev).
 * Behind Coolify's proxy the public host arrives in x-forwarded-host. A passkey works only on the host it was made on.
 */
export function relyingParty(headers: Headers): { rpID: string; origin: string } {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  const hostname = host.replace(/:\d+$/, "");
  const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
  const proto = (headers.get("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0].trim();
  return { rpID: hostname, origin: `${proto}://${host}` };
}

export async function setChallenge(ceremony: Ceremony, challenge: string, userId?: string) {
  const token = await new SignJWT({ c: challenge, p: ceremony, ...(userId ? { u: userId } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SECONDS}s`)
    .sign(secret());
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/webauthn",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

/** Reads and deletes the pending challenge (single use). Null if missing, expired, tampered or for another ceremony / user. */
export async function takeChallenge(ceremony: Ceremony, userId?: string): Promise<string | null> {
  const store = await cookies();
  const token = store.get(CHALLENGE_COOKIE)?.value;
  store.set(CHALLENGE_COOKIE, "", { path: "/api/auth/webauthn", maxAge: 0 });
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.p !== ceremony || typeof payload.c !== "string") return null;
    if (userId && payload.u !== userId) return null;
    return payload.c;
  } catch {
    return null;
  }
}

export const toTransports = (json: string | null | undefined): AuthenticatorTransportFuture[] | undefined => {
  try {
    const t = JSON.parse(json ?? "null");
    return Array.isArray(t) ? (t as AuthenticatorTransportFuture[]) : undefined;
  } catch {
    return undefined;
  }
};

