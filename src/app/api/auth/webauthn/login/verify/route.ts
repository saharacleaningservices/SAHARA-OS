import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { getDeviceToken, labelFromUserAgent } from "@/lib/device";
import { relyingParty, takeChallenge, toTransports } from "@/lib/webauthn";
import { DEVICE_GATED_ROLES, finishLogin } from "@/server/login-session";

// Sign-in step 2 (public): verify the passkey signature, then issue the same session as a password login.
export async function POST(request: NextRequest) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`webauthn:verify:ip:${ip}`, 10, 600).allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const challenge = await takeChallenge("login");
  if (!challenge) return NextResponse.json({ error: "Sign-in timed out — please try again." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { response?: AuthenticationResponseJSON } | null;
  const response = body?.response;
  if (!response?.id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const cred = await db.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
    include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true, isActive: true } } },
  });

  const fail = async (reason: string, userId?: string) => {
    await db.auditLog
      .create({
        data: {
          entityType: "Login",
          entityId: userId ?? "biometric",
          action: "LOGIN_FAILED",
          summary: `Biometric sign-in failed (${reason}) from ${labelFromUserAgent(request.headers.get("user-agent"))} · ${ip}`,
        },
      })
      .catch(() => {});
    return NextResponse.json({ error: "Biometric sign-in did not work on this device. Please sign in with your password." }, { status: 401 });
  };
  if (!cred) return fail("unknown passkey");
  if (!cred.user.isActive) return fail("account inactive", cred.userId);

  const { rpID, origin } = relyingParty(request.headers);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credentialId,
        publicKey: new Uint8Array(Buffer.from(cred.publicKey, "base64url")),
        counter: cred.counter,
        transports: toTransports(cred.transports),
      },
    });
  } catch {
    return fail("signature check", cred.userId);
  }
  if (!verification.verified) return fail("signature check", cred.userId);

  // The owner's device approval still applies: a passkey (which can sync to a new phone) never bypasses it.
  if (DEVICE_GATED_ROLES.has(cred.user.role)) {
    const deviceToken = await getDeviceToken();
    const device = deviceToken ? await db.device.findFirst({ where: { token: deviceToken, userId: cred.userId, status: "APPROVED" } }) : null;
    if (!device) {
      return NextResponse.json(
        { error: "This device is not approved yet. Sign in with your password once to request approval." },
        { status: 403 },
      );
    }
    await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  }

  await db.webAuthnCredential.update({
    where: { id: cred.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  await finishLogin(cred.user, request, "biometric");
  return NextResponse.json({ user: { id: cred.user.id, name: cred.user.name, role: cred.user.role } });
}
