import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/constants";
import { brandedEmail, renderSignatureHtml, type SignatureInput } from "@/lib/email-signature";
import { getCompanySettings } from "@/server/settings";

/** Signature inputs from Settings (phone, email, address, LinkedIn, Google rating) + the sending team member. */
export async function signatureFor(senderUserId?: string | null): Promise<SignatureInput> {
  const [s, u] = await Promise.all([
    getCompanySettings(),
    senderUserId ? db.user.findUnique({ where: { id: senderUserId }, select: { name: true, role: true } }) : Promise.resolve(null),
  ]);
  return {
    name: u?.name ?? null,
    role: u ? (ROLE_LABELS[u.role] ?? u.role) : null,
    phone: s.phone,
    email: s.email,
    address: s.address,
    linkedinUrl: s.linkedinUrl,
    googleRating: s.googleRating,
    googleReviewCount: s.googleReviewCount,
  };
}

/**
 * Branded email (message + HTML signature + plain-text twin) for customer / admin mail — quotations, invoices,
 * booking confirmations, admin notifications. Not for OTP / password-recovery mail, which stays minimal.
 */
export async function brandedEmailFor(message: string, senderUserId?: string | null) {
  return brandedEmail(message, await signatureFor(senderUserId));
}

export async function signatureHtmlFor(senderUserId?: string | null) {
  return renderSignatureHtml(await signatureFor(senderUserId));
}
