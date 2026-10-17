// Biometric sign-in (WebAuthn passkeys): real P-256 signatures through the same verify calls and key storage
// format the routes use, plus guards on the security rules. Run: npm run test:webauthn
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import { relyingParty } from "../src/lib/webauthn";

const read = (f: string) => readFileSync(f, "utf8");
const b64u = (b: Uint8Array | Buffer) => Buffer.from(b).toString("base64url");
const sha256 = (b: Uint8Array | Buffer | string) => createHash("sha256").update(b).digest();

// A minimal software "phone": an EC P-256 passkey with user-verification (Face ID) flags set.
function fakeAuthenticator(rpID: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const credId = Buffer.from("cred-" + Math.random().toString(36).slice(2));
  const cose = new Map<number, number | Uint8Array>([
    [1, 2], // kty EC2
    [3, -7], // alg ES256
    [-1, 1], // crv P-256
    [-2, Buffer.from(jwk.x, "base64url")],
    [-3, Buffer.from(jwk.y, "base64url")],
  ]);
  let counter = 0;
  const authData = (attested: boolean) => {
    const flags = 0x01 | 0x04 | (attested ? 0x40 : 0); // UP | UV | AT
    const cnt = Buffer.alloc(4);
    cnt.writeUInt32BE(++counter);
    const head = Buffer.concat([sha256(rpID), Buffer.from([flags]), cnt]);
    if (!attested) return head;
    const len = Buffer.alloc(2);
    len.writeUInt16BE(credId.length);
    return Buffer.concat([head, Buffer.alloc(16), len, credId, Buffer.from(isoCBOR.encode(cose))]);
  };
  const clientData = (type: string, challenge: string, origin: string) => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  return {
    register(challenge: string, origin: string) {
      const cd = clientData("webauthn.create", challenge, origin);
      const att = isoCBOR.encode(new Map<string, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData(true)]]));
      return {
        id: b64u(credId),
        rawId: b64u(credId),
        type: "public-key" as const,
        clientExtensionResults: {},
        response: { clientDataJSON: b64u(cd), attestationObject: b64u(att), transports: ["internal" as const] },
      };
    },
    assert(challenge: string, origin: string) {
      const cd = clientData("webauthn.get", challenge, origin);
      const ad = authData(false);
      const sig = sign("sha256", Buffer.concat([ad, sha256(cd)]), privateKey);
      return {
        id: b64u(credId),
        rawId: b64u(credId),
        type: "public-key" as const,
        clientExtensionResults: {},
        response: { clientDataJSON: b64u(cd), authenticatorData: b64u(ad), signature: b64u(sig) },
      };
    },
  };
}

test("register → store public key as base64url → sign in: verified, counter advances; other origin / stale challenge rejected", async () => {
  const rpID = "crm.saharacleaningservices.com";
  const origin = `https://${rpID}`;
  const phone = fakeAuthenticator(rpID);

  const regOpts = await generateRegistrationOptions({ rpName: "Sahara OS", rpID, userID: new TextEncoder().encode("user-1"), userName: "9000000000", attestationType: "none", authenticatorSelection: { residentKey: "required", userVerification: "required" } });
  const reg = await verifyRegistrationResponse({ response: phone.register(regOpts.challenge, origin), expectedChallenge: regOpts.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  assert.equal(reg.verified, true);

  // Exactly what register/verify stores and login/verify reads back.
  const stored = { credentialId: reg.registrationInfo!.credential.id, publicKey: Buffer.from(reg.registrationInfo!.credential.publicKey).toString("base64url"), counter: reg.registrationInfo!.credential.counter };
  const asCredential = () => ({ id: stored.credentialId, publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")), counter: stored.counter });

  const authOpts = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  const ok = await verifyAuthenticationResponse({ response: phone.assert(authOpts.challenge, origin), expectedChallenge: authOpts.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, credential: asCredential() });
  assert.equal(ok.verified, true);
  assert.ok(ok.authenticationInfo.newCounter > stored.counter);
  stored.counter = ok.authenticationInfo.newCounter;

  // A phishing site (different origin) cannot use the signature.
  const o2 = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await assert.rejects(verifyAuthenticationResponse({ response: phone.assert(o2.challenge, "https://evil.example"), expectedChallenge: o2.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, credential: asCredential() }));
  // A replayed response for an old challenge is refused.
  const o3 = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await assert.rejects(verifyAuthenticationResponse({ response: phone.assert(authOpts.challenge, origin), expectedChallenge: o3.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true, credential: asCredential() }));
});

test("relying party comes from the public host (proxy header first); localhost uses http", () => {
  assert.deepEqual(relyingParty(new Headers({ host: "app:3000", "x-forwarded-host": "crm.saharacleaningservices.com", "x-forwarded-proto": "https" })), { rpID: "crm.saharacleaningservices.com", origin: "https://crm.saharacleaningservices.com" });
  assert.deepEqual(relyingParty(new Headers({ host: "localhost:3006" })), { rpID: "localhost", origin: "http://localhost:3006" });
});

test("security rules: UV required, device approval kept, single-use signed challenge, public login routes only, passkeys removed on revoke", () => {
  const dir = "src/app/api/auth/webauthn";
  for (const f of ["register/verify", "login/verify", "unlock/verify"]) assert.ok(read(`${dir}/${f}/route.ts`).includes("requireUserVerification: true"), f);
  const login = read(`${dir}/login/verify/route.ts`);
  assert.ok(login.includes("DEVICE_GATED_ROLES.has(cred.user.role)") && login.includes(`status: "APPROVED"`), "gated roles need an approved device");
  assert.ok(login.includes("cred.user.isActive"), "inactive accounts refused");
  assert.ok(login.includes("finishLogin(cred.user, request, \"biometric\")"), "same session + audit as password login");
  assert.ok(read(`${dir}/unlock/verify/route.ts`).includes("userId: session.sub"), "unlock only with the signed-in user's own passkey");
  for (const f of ["register/options", "register/verify", "unlock/options", "unlock/verify"]) assert.ok(read(`${dir}/${f}/route.ts`).includes("getSession()"), `${f} needs a session`);
  const lib = read("src/lib/webauthn.ts");
  assert.ok(lib.includes("httpOnly: true") && lib.includes(`sameSite: "strict"`) && lib.includes("maxAge: 0"), "challenge cookie is httpOnly, strict and deleted after use");
  const mw = read("src/middleware.ts");
  assert.ok(mw.includes(`"/api/auth/webauthn/login"`) && !mw.includes(`"/api/auth/webauthn"\n`) && !mw.includes(`"/api/auth/webauthn",`), "only the login ceremony is public");
  assert.ok(read("src/lib/session.ts").includes("webAuthnCredential.deleteMany({ where: { userId } })"));
  assert.match(read("prisma/schema.prisma"), /model WebAuthnCredential \{[\s\S]*onDelete: Cascade/);
  assert.ok(read("scripts/db-setup.mjs").includes(`CREATE TABLE IF NOT EXISTS "WebAuthnCredential"`));
});

test("password login still goes through device approval, then the shared session helper", () => {
  const route = read("src/app/api/auth/login/route.ts");
  assert.ok(route.includes("DEVICE_GATED_ROLES.has(user.role)"));
  assert.ok(route.includes(`await finishLogin(user, request, "password")`));
  const helper = read("src/server/login-session.ts");
  assert.ok(helper.includes(`action: "LOGIN_SUCCESS"`) && helper.includes("setSessionCookie(token)"));
});
