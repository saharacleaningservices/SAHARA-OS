import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { relyingParty, takeChallenge, toTransports } from "@/lib/webauthn";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Signed out." }, { status: 401 });
  const challenge = await takeChallenge("unlock", session.sub);
  if (!challenge) return NextResponse.json({ error: "Timed out — try again." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { response?: AuthenticationResponseJSON } | null;
  const response = body?.response;
  if (!response?.id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  // The passkey must belong to the user who is signed in.
  const cred = await db.webAuthnCredential.findFirst({ where: { credentialId: response.id, userId: session.sub } });
  if (!cred) return NextResponse.json({ error: "Not your passkey." }, { status: 403 });
  const { rpID, origin } = relyingParty(request.headers);
  try {
    const v = await verifyAuthenticationResponse({
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
    if (!v.verified) return NextResponse.json({ error: "Could not verify." }, { status: 401 });
    await db.webAuthnCredential.update({ where: { id: cred.id }, data: { counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not verify." }, { status: 401 });
  }
}
