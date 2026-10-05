"use server";

import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { staffSchema } from "@/lib/validation";
import { generateEmployeeCode } from "@/lib/id-generators";
import { softDeleteMany } from "@/server/audit";
import { canDeleteRecords, canViewSalary } from "@/lib/permissions";

/**
 * createStaff/updateStaff carry wage/bank/GPay fields and had no role check
 * at all before the 2026-09-21 Francis policy audit — only the UI trigger
 * (the Add/Edit Staff dialog) was hidden for roles without canViewSalary,
 * which doesn't stop a direct action call. Gating by canViewSalary matches
 * what the Staff list page (staff/page.tsx) and the now-fixed Staff detail
 * page already enforce in the UI — not a new restriction on any role that
 * could actually reach this before.
 */
export async function createStaff(values: unknown) {
  const session = await getSession();
  if (!canViewSalary(session?.role ?? "")) return { error: "Not authorized", success: false as const };
  const parsed = staffSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  const employeeCode = await generateEmployeeCode();

  const staff = await db.staff.create({
    data: {
      employeeCode,
      name: data.name,
      mobile: data.mobile,
      alternateMobile: data.alternateMobile || null,
      designation: data.designation,
      salaryType: data.salaryType,
      dailyWage: data.salaryType === "DAILY" ? data.dailyWage ?? null : null,
      monthlySalary: data.salaryType === "MONTHLY" ? data.monthlySalary ?? null : null,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
      reference: data.reference || null,
      bankAccount: data.bankAccount || null,
      bankIfsc: data.bankIfsc || null,
      gpayNumber: data.gpayNumber || null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/staff");
  return { success: true as const, staffId: staff.id };
}

export async function updateStaff(id: string, values: unknown) {
  const session = await getSession();
  if (!canViewSalary(session?.role ?? "")) return { error: "Not authorized", success: false as const };
  const parsed = staffSchema.partial().safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data", success: false as const };
  }
  const data = parsed.data;
  await db.staff.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.mobile && { mobile: data.mobile }),
      ...(data.alternateMobile !== undefined && { alternateMobile: data.alternateMobile || null }),
      ...(data.designation && { designation: data.designation }),
      ...(data.salaryType && { salaryType: data.salaryType }),
      ...(data.dailyWage !== undefined && { dailyWage: data.dailyWage }),
      ...(data.monthlySalary !== undefined && { monthlySalary: data.monthlySalary }),
      ...(data.joiningDate !== undefined && {
        joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
      }),
      ...(data.reference !== undefined && { reference: data.reference || null }),
      ...(data.bankAccount !== undefined && { bankAccount: data.bankAccount || null }),
      ...(data.bankIfsc !== undefined && { bankIfsc: data.bankIfsc || null }),
      ...(data.gpayNumber !== undefined && { gpayNumber: data.gpayNumber || null }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });
  revalidatePath("/staff");
  revalidatePath(`/staff/${id}`);
  return { success: true as const };
}

type StaffDocument = { label: string; url: string; uploadedAt: string };

/** Attach a document (Aadhaar, PAN, passbook, joining letter, …) to a staff
 * member's document folder. Files are uploaded first via POST /api/upload. */
export async function addStaffDocument(staffId: string, doc: { label: string; url: string }) {
  const session = await getSession();
  if (!session || !canDeleteRecords(session.role)) {
    return { error: "Not authorized", success: false as const };
  }
  if (!doc.url?.startsWith("/uploads/") || !doc.label?.trim()) {
    return { error: "Invalid document", success: false as const };
  }
  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { documents: true } });
  if (!staff) return { error: "Staff not found", success: false as const };

  const list: StaffDocument[] = staff.documents ? JSON.parse(staff.documents) : [];
  list.push({ label: doc.label.trim().slice(0, 60), url: doc.url, uploadedAt: new Date().toISOString() });
  await db.staff.update({ where: { id: staffId }, data: { documents: JSON.stringify(list) } });
  revalidatePath(`/staff/${staffId}`);
  return { success: true as const };
}

export async function removeStaffDocument(staffId: string, url: string) {
  const session = await getSession();
  if (!session || !canDeleteRecords(session.role)) {
    return { error: "Not authorized", success: false as const };
  }
  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { documents: true } });
  if (!staff) return { error: "Staff not found", success: false as const };
  const list: StaffDocument[] = staff.documents ? JSON.parse(staff.documents) : [];
  await db.staff.update({
    where: { id: staffId },
    data: { documents: JSON.stringify(list.filter((d) => d.url !== url)) },
  });
  revalidatePath(`/staff/${staffId}`);
  return { success: true as const };
}

export async function deleteStaff(id: string) {
  const session = await getSession();
  if (!session || !canDeleteRecords(session.role)) return { error: "Not authorized" };
  await softDeleteMany("Staff", [id], session);
  revalidatePath("/staff");
  return { success: true };
}

export async function bulkDeleteStaff(ids: string[]) {
  const session = await getSession();
  if (!session || !canDeleteRecords(session.role)) return { error: "Not authorized" };
  const count = await softDeleteMany("Staff", ids, session);
  revalidatePath("/staff");
  return { success: true as const, count };
}

export async function updateAvailability(staffId: string, availability: "AVAILABLE" | "ON_JOB" | "ON_LEAVE" | "OFF_DUTY") {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  await db.staff.update({ where: { id: staffId }, data: { availability } });
  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function markAttendance(
  staffId: string,
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE",
  method: "MANUAL" | "QR" | "GPS" = "MANUAL"
) {
  // RBAC 2026-10-05: server-side role check (staff and unauthorised roles refused).
  {
    const __s = await getSession();
    if (!__s || !["ADMIN", "ACCOUNTS"].includes(__s.role)) return { error: "Not authorized", success: false } as never;
  }
  const staff = await db.staff.findUnique({ where: { id: staffId } });
  if (!staff) return { error: "Staff not found", success: false as const };

  const today = startOfDay(new Date());
  const dailyRate = staff.salaryType === "DAILY" ? staff.dailyWage ?? 0 : (staff.monthlySalary ?? 0) / 30;
  const wageForDay = status === "ABSENT" ? 0 : status === "HALF_DAY" ? dailyRate / 2 : dailyRate;

  await db.attendance.upsert({
    where: { staffId_date: { staffId, date: today } },
    update: { status, wageForDay, method, checkInTime: status !== "ABSENT" ? new Date() : null },
    create: {
      staffId,
      date: today,
      status,
      wageForDay,
      method,
      checkInTime: status !== "ABSENT" ? new Date() : null,
    },
  });

  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/dashboard");
  return { success: true as const };
}
