"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { companySettingsSchema, changePasswordSchema, strongPasswordSchema, staffChangePinSchema } from "@/lib/validation";

export async function updateCompanySettings(values: unknown) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  if (session.role !== "ADMIN") return { error: "Only an admin can change company settings" };

  const parsed = companySettingsSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const data = parsed.data;

  await db.companySettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      website: data.website || null,
      logoUrl: data.logoUrl || null,
      googleReviewUrl: data.googleReviewUrl || null,
      googleRating: data.googleRating || null,
      linkedinUrl: data.linkedinUrl || null,
      signatureLogoWidth: data.signatureLogoWidth ? Number(data.signatureLogoWidth) : null,
      signatureLogoHeight: data.signatureLogoHeight ? Number(data.signatureLogoHeight) : null,
      googleReviewCount: data.googleReviewCount || null,
      happyCustomers: data.happyCustomers || null,
      featuredReviews: data.featuredReviews || null,
      upiId: data.upiId || null,
      upiQrUrl: data.upiQrUrl || null,
      bankName: data.bankName || null,
      bankAccountName: data.bankAccountName || null,
      bankAccountNumber: data.bankAccountNumber || null,
      bankIfsc: data.bankIfsc || null,
    },
    update: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      website: data.website || null,
      logoUrl: data.logoUrl || null,
      googleReviewUrl: data.googleReviewUrl || null,
      googleRating: data.googleRating || null,
      linkedinUrl: data.linkedinUrl || null,
      signatureLogoWidth: data.signatureLogoWidth ? Number(data.signatureLogoWidth) : null,
      signatureLogoHeight: data.signatureLogoHeight ? Number(data.signatureLogoHeight) : null,
      googleReviewCount: data.googleReviewCount || null,
      happyCustomers: data.happyCustomers || null,
      featuredReviews: data.featuredReviews || null,
      upiId: data.upiId || null,
      upiQrUrl: data.upiQrUrl || null,
      bankName: data.bankName || null,
      bankAccountName: data.bankAccountName || null,
      bankAccountNumber: data.bankAccountNumber || null,
      bankIfsc: data.bankIfsc || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Step 1 of a password change. Validates the current password and the new
 * password against the strong-password policy, then raises an OTP that is
 * delivered ONLY to the Super Admin (Altaf). The change is not applied until
 * confirmPasswordChange() succeeds with the code Altaf relays.
 *
 * The Super Admin's own password change is applied immediately (Altaf is the
 * approver — there is no one above him to OTP).
 */
export async function changePassword(values: unknown) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };

  // Field Staff use a simple 4–6 digit PIN; office roles keep the password policy.
  const parsed = (session.role === "STAFF" ? staffChangePinSchema : changePasswordSchema).safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user) return { error: "Account not found" };

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect" };

  // Super Admin, and Field Staff changing their own Staff App PIN (owner
  // rule 2026-10-04: a logged-in staff member changes it themselves, no owner
  // OTP — they've just proved the current password). Office roles keep OTP.
  if (user.role === "ADMIN" || user.role === "STAFF") {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });
    await db.auditLog
      .create({
        data: { entityType: "User", entityId: user.id, action: "PASSWORD_CHANGED_SELF", summary: `${user.name} changed their own password`, actorName: user.name, actorEmail: user.email },
      })
      .catch(() => {});
    return { success: true as const };
  }

  const { requestPasswordOtp } = await import("@/server/security");
  const { otpId, ttlMinutes } = await requestPasswordOtp({
    targetUserId: user.id,
    targetUserName: user.name,
    targetUserEmail: user.email,
    newPassword,
    purpose: "PASSWORD_CHANGE",
    requestedByName: session.name,
  });

  return { otpRequired: true as const, otpId, ttlMinutes };
}

/**
 * First-login password setup — retires the shared onboarding password. The
 * user is already authenticated with the shared password, so this does NOT
 * need a Super-Admin OTP; it just enforces the strong-password policy and
 * clears the mustChangePassword flag. Later changes go through the OTP flow.
 */
export async function setInitialPassword(values: unknown) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };

  const parsed = strongPasswordSchema.safeParse(
    (values as { newPassword?: unknown })?.newPassword,
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Choose a stronger password" };
  }

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user) return { error: "Account not found" };
  if (!user.mustChangePassword) return { error: "No password reset is pending for this account" };

  // Don't allow keeping the same (shared) password.
  if (await verifyPassword(parsed.data, user.passwordHash)) {
    return { error: "Choose a password different from the one you were given" };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data), mustChangePassword: false },
  });
  await db.auditLog
    .create({
      data: {
        entityType: "Security",
        entityId: user.id,
        action: "INITIAL_PASSWORD_SET",
        summary: `${user.name} (${user.email}) set their own password on first login`,
        actorName: user.name,
        actorEmail: user.email,
      },
    })
    .catch(() => {});
  return { success: true as const };
}

/** Step 2 — apply the pending password once the Super Admin's OTP is entered. */
export async function confirmPasswordChange(otpId: string, code: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  if (!otpId || !code?.trim()) return { error: "Enter the code from the Super Admin" };

  const { confirmPasswordOtp } = await import("@/server/security");
  return confirmPasswordOtp(otpId, code);
}
