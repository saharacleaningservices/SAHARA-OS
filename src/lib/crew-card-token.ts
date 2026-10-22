// Signed link for the crew job card (/crew-card/{jobId}.{sig}). The signature is an HMAC of the job id with AUTH_SECRET, so a
// link can't be guessed or forged from a job number, and it carries no customer data. Not the customer's booking token:
// the crew card holds internal notes that the customer must never see.
import { createHmac, timingSafeEqual } from "node:crypto";

const sig = (jobId: string) => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`crew-card:${jobId}`).digest("base64url").slice(0, 24);
};

export const crewCardToken = (jobId: string) => `${jobId}.${sig(jobId)}`;

/** Returns the job id when the token is genuine, else null. */
export function verifyCrewCardToken(token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const jobId = token.slice(0, i);
  const given = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(sig(jobId));
  return given.length === want.length && timingSafeEqual(given, want) ? jobId : null;
}
