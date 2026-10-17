import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { relyingParty, setChallenge } from "@/lib/webauthn";

// Sign-in step 1 (public): a challenge only — no account data. The phone shows its own passkey picker.
export async function POST(request: NextRequest) {
  if (!rateLimit(`webauthn:login:ip:${clientIp(request.headers)}`, 20, 600).allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const { rpID } = relyingParty(request.headers);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await setChallenge("login", options.challenge);
  return NextResponse.json(options);
}
