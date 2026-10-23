// Short customer links (owner 2026-10-24): booking.saharacleaningservices.com/q/<code> (quotation), /i/<code> (invoice), /p/<code> (pay advance),
// /b/<code> (booking page). The code is 10 random letters/digits per job (62^10 ≈ 8e17 — not guessable, and every route is rate-limited);
// the long booking token keeps working everywhere it did before. Not a "use server" module.
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const SHORT_CODE_RE = /^[A-Za-z0-9]{10}$/;
export type ShortKind = "q" | "i" | "p" | "b";

export function newShortCode(): string {
  let out = "";
  while (out.length < 10) {
    const b = randomBytes(16);
    for (const x of b) if (x < 248 && out.length < 10) out += ALPHABET[x % 62]; // 248 = 62*4: no modulo bias
  }
  return out;
}

/** The job's short code, created on first use. */
export async function ensureShortCode(jobId: string): Promise<string> {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { shortCode: true } });
  if (job?.shortCode) return job.shortCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const code = newShortCode();
      await db.job.update({ where: { id: jobId }, data: { shortCode: code } });
      return code;
    } catch (e) {
      const clash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!clash) throw e;
      const again = await db.job.findUnique({ where: { id: jobId }, select: { shortCode: true } });
      if (again?.shortCode) return again.shortCode;
    }
  }
  throw new Error("Could not allocate a short code");
}

export const shortUrl = (kind: ShortKind, code: string) => `${PUBLIC_BOOKING_URL}/${kind}/${code}`;

/** Short URL for a job, creating the code when needed. */
export async function shortUrlForJob(kind: ShortKind, jobId: string) {
  return shortUrl(kind, await ensureShortCode(jobId));
}

/** The booking token (created on first use, exactly like ensureJobToken in booking-messages — kept local to avoid an import cycle). */
async function tokenFor(jobId: string): Promise<string> {
  const j = await db.job.findUnique({ where: { id: jobId }, select: { publicToken: true } });
  if (j?.publicToken) return j.publicToken;
  const token = randomBytes(18).toString("base64url");
  await db.job.update({ where: { id: jobId }, data: { publicToken: token } });
  return token;
}

/** Where a short link goes: the single-page A4 PDF when it exists, else the booking page; `p` goes to the pay-advance page. */
export async function shortLinkTarget(kind: ShortKind, code: string): Promise<string | null> {
  if (!SHORT_CODE_RE.test(code)) return null;
  const job = await db.job.findFirst({
    where: { shortCode: code, deletedAt: null },
    select: { id: true, invoice: { select: { id: true } }, lead: { select: { quotations: { select: { id: true }, take: 1 } } } },
  });
  if (!job) return null;
  const token = await tokenFor(job.id);
  if (kind === "p") return `/booking/pay/${token}`;
  if (kind === "i") return job.invoice ? `/booking/invoice/${token}/pdf` : `/booking/${token}`;
  if (kind === "q") return job.lead?.quotations.length ? `/booking/quotation/${token}/pdf` : `/booking/quotation/${token}`;
  return `/booking/${token}`;
}
