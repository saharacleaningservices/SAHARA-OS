import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { RP_NAME, relyingParty, setChallenge, toTransports } from "@/lib/webauthn";

// Step 1 of "Enable biometric sign-in on this device" — only for a signed-in user.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!rateLimit(`webauthn:reg:${session.sub}`, 10, 600).allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const user = await db.user.findUnique({ where: { id: session.sub }, select: { id: true, name: true, email: true, phone: true, isActive: true } });
  if (!user?.isActive) return NextResponse.json({ error: "Account not active." }, { status: 403 });
  const existing = await db.webAuthnCredential.findMany({ where: { userId: user.id }, select: { credentialId: true, transports: true } });

  const { rpID } = relyingParty(request.headers);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.phone || user.email,
    userDisplayName: user.name,
    attestationType: "none",
    // Discoverable passkey on this phone / laptop, unlocked by Face ID, fingerprint or the device PIN.
    authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
    excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: toTransports(c.transports) })),
  });
  await setChallenge("register", options.challenge, user.id);
  return NextResponse.json(options);
}
