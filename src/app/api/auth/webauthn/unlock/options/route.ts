import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { relyingParty, setChallenge, toTransports } from "@/lib/webauthn";

// App lock: re-confirm the signed-in user with Face ID / fingerprint / device PIN.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Signed out." }, { status: 401 });
  const creds = await db.webAuthnCredential.findMany({ where: { userId: session.sub }, select: { credentialId: true, transports: true } });
  if (!creds.length) return NextResponse.json({ error: "Biometric sign-in is not set up." }, { status: 400 });
  const { rpID } = relyingParty(request.headers);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: creds.map((c) => ({ id: c.credentialId, transports: toTransports(c.transports) })),
  });
  await setChallenge("unlock", options.challenge, session.sub);
  return NextResponse.json(options);
}
