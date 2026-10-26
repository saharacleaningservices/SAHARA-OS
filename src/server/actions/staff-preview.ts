"use server";

// Owner-only, read-only preview of any staff member's Staff App (/my).
// Sets a short-lived httpOnly cookie that requireMyStaff honours ONLY for an
// ADMIN session — staff logins ignore it, so staff isolation is unchanged.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { STAFF_PREVIEW_COOKIE } from "@/server/staff-portal-session";

export async function startStaffPreview(staffId: string): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/dashboard");
  const staff = await db.staff.findFirst({ where: { id: staffId, deletedAt: null }, select: { id: true, name: true, employeeCode: true } });
  if (!staff) redirect("/staff");

  (await cookies()).set(STAFF_PREVIEW_COOKIE, staff.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2,
  });
  await db.auditLog
    .create({
      data: {
        entityType: "Staff",
        entityId: staff.id,
        action: "STAFF_APP_PREVIEW",
        summary: `${session.name} previewed the Staff App as ${staff.name} (${staff.employeeCode}) — read-only`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});
  redirect("/my");
}

export async function exitStaffPreview() {
  const store = await cookies();
  const id = store.get(STAFF_PREVIEW_COOKIE)?.value;
  store.delete(STAFF_PREVIEW_COOKIE);
  redirect(id ? `/staff/${id}` : "/staff");
}
