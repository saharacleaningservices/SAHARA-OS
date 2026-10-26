"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { createUserSchema, type CreateUserFormValues } from "@/lib/validation";

// Admin-only User Management — create accounts, change role, activate /
// deactivate, and reset a forgotten password. Reuses the existing auth
// primitives (bcrypt via src/lib/auth.ts, the mustChangePassword flag that
// already powers /set-password, and User.isActive which the login route
// already checks) rather than introducing a second auth mechanism.

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // no 0/O/1/I/l — easier to read aloud/type
function generateTempPassword(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CHARSET[bytes[i] % CHARSET.length];
  return out;
}

async function requireAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function listUsers() {
  const session = await requireAdminSession();
  if (!session) return { error: "Only the owner can view User Management" as const, users: [] };

  const users = await db.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });
  return { users };
}

export async function createUser(values: unknown) {
  const session = await requireAdminSession();
  if (!session) return { error: "Only the owner can create users" };

  const parsed = createUserSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const data: CreateUserFormValues = parsed.data;

  const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) return { error: "A user with this email already exists" };

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      role: data.role,
      passwordHash: await hashPassword(data.password),
      // Same policy as the seeded demo accounts: the office password is
      // shared once by the owner, then the new user must set their own on
      // first login (src/server/actions/settings.ts → setInitialPassword).
      mustChangePassword: true,
    },
  });

  await db.auditLog.create({
    data: {
      entityType: "User",
      entityId: user.id,
      action: "USER_CREATED",
      summary: `Created user ${user.name} (${user.email}) with role ${user.role}`,
      actorName: session.name,
      actorEmail: session.email,
    },
  });

  revalidatePath("/admin/users");
  return { success: true as const };
}

export async function updateUserRole(userId: string, role: string) {
  const session = await requireAdminSession();
  if (!session) return { error: "Only the owner can change roles" };
  if (!createUserSchema.shape.role.safeParse(role).success) return { error: "Invalid role" };

  if (userId === session.sub) return { error: "You can't change your own role" };

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found" };

  if (target.role === "ADMIN" && role !== "ADMIN") {
    const otherAdmins = await db.user.count({ where: { role: "ADMIN", isActive: true, id: { not: userId } } });
    if (otherAdmins === 0) return { error: "At least one active Owner (Admin) account must remain" };
  }

  await db.user.update({ where: { id: userId }, data: { role: role as typeof target.role } });

  await db.auditLog.create({
    data: {
      entityType: "User",
      entityId: userId,
      action: "USER_ROLE_CHANGED",
      summary: `Changed ${target.name} (${target.email}) role: ${target.role} → ${role}`,
      actorName: session.name,
      actorEmail: session.email,
    },
  });

  revalidatePath("/admin/users");
  return { success: true as const };
}

export async function setUserActive(userId: string, isActive: boolean) {
  const session = await requireAdminSession();
  if (!session) return { error: "Only the owner can activate or deactivate users" };
  if (userId === session.sub) return { error: "You can't deactivate your own account" };

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found" };

  if (!isActive && target.role === "ADMIN") {
    const otherActiveAdmins = await db.user.count({ where: { role: "ADMIN", isActive: true, id: { not: userId } } });
    if (otherActiveAdmins === 0) return { error: "At least one active Owner (Admin) account must remain" };
  }

  await db.user.update({ where: { id: userId }, data: { isActive } });

  await db.auditLog.create({
    data: {
      entityType: "User",
      entityId: userId,
      action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      summary: `${isActive ? "Activated" : "Deactivated"} ${target.name} (${target.email})`,
      actorName: session.name,
      actorEmail: session.email,
    },
  });

  revalidatePath("/admin/users");
  return { success: true as const };
}

// Returns the new temporary password ONCE, in the response only — never
// written to the audit log or stored anywhere in plain text. The user is
// forced through /set-password (existing flow) on next login.
export async function resetUserPassword(userId: string) {
  const session = await requireAdminSession();
  if (!session) return { error: "Only the owner can reset a password" };

  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "User not found" };

  const tempPassword = generateTempPassword();
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });

  await db.auditLog.create({
    data: {
      entityType: "User",
      entityId: userId,
      action: "USER_PASSWORD_RESET",
      summary: `Reset password for ${target.name} (${target.email}) — a temporary password was issued`,
      actorName: session.name,
      actorEmail: session.email,
    },
  });

  revalidatePath("/admin/users");
  return { success: true as const, tempPassword };
}
