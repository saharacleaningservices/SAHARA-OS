"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { companySettingsSchema, changePasswordSchema } from "@/lib/validation";

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
      logoUrl: data.logoUrl || null,
    },
    update: {
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      logoUrl: data.logoUrl || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function changePassword(values: unknown) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };

  const parsed = changePasswordSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user) return { error: "Account not found" };

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect" };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return { success: true };
}
