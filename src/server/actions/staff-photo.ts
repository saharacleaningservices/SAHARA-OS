"use server";

// Staff profile photo (optional — never required for login, attendance or
// jobs). Staff update their own photo from the Staff App; Super Admin,
// Accounts, Operations (Francis) and Supervisor can update anyone's from the
// CRM staff profile. Files are uploaded first via POST /api/upload (folder "staff").

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// RBAC 2026-10-05: staff editing (incl. photo) = Super Admin + Accounts (Shweta); never Francis.
const MANAGERS = new Set(["ADMIN", "ACCOUNTS"]);

/** staffId is ignored for STAFF logins — they can only change their own photo. */
export async function setStaffPhoto(staffId: string | null, url: string | null) {
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };
  if (url !== null && !url.startsWith("/uploads/staff/")) return { error: "Invalid photo." };

  let targetId: string | null = null;
  if (session.role === "STAFF") {
    const own = await db.staff.findFirst({ where: { userId: session.sub, deletedAt: null }, select: { id: true } });
    targetId = own?.id ?? null;
  } else if (MANAGERS.has(session.role) && staffId) {
    targetId = staffId;
  }
  if (!targetId) return { error: "Not authorized." };

  await db.staff.update({ where: { id: targetId }, data: { photoUrl: url } });
  revalidatePath("/my");
  revalidatePath("/my/account");
  revalidatePath(`/staff/${targetId}`);
  revalidatePath("/staff");
  return { ok: true };
}
