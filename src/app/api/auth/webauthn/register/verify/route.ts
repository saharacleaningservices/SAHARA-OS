import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { labelFromUserAgent } from "@/lib/device";
import { relyingParty, takeChallenge } from "@/lib/webauthn";

// Step 2: store the new passkey's PUBLIC key for the signed-in user.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const challenge = await takeChallenge("register", session.sub);
  if (!challenge) return NextResponse.json({ error: "Setup timed out — please try again." }, { status: 400 });

  const body = (await request.json().catch(() => null)) as { response?: RegistrationResponseJSON } | null;
  if (!body?.response) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { rpID, origin } = relyingParty(request.headers);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json({ error: "Could not verify this device." }, { status: 400 });
  }
  if (!verification.verified) return NextResponse.json({ error: "Could not verify this device." }, { status: 400 });

  const { credential } = verification.registrationInfo;
  const label = labelFromUserAgent(request.headers.get("user-agent"));
  await db.webAuthnCredential.upsert({
    where: { credentialId: credential.id },
    create: {
      userId: session.sub,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ? JSON.stringify(credential.transports) : null,
      label,
    },
    update: {},
  });
  await db.auditLog
    .create({
      data: {
        entityType: "User",
        entityId: session.sub,
        action: "BIOMETRIC_ENABLED",
        summary: `${session.name} enabled biometric sign-in on ${label}`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});
  return NextResponse.json({ ok: true, credentialId: credential.id, label });
}
