"use server";

import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";
import { db } from "@/lib/db";
import { staffSchema } from "@/lib/validation";
import { generateEmployeeCode } from "@/lib/id-generators";

export async function createStaff(values: unknown) {
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
      designation: data.designation,
      salaryType: data.salaryType,
      dailyWage: data.salaryType === "DAILY" ? data.dailyWage ?? null : null,
      monthlySalary: data.salaryType === "MONTHLY" ? data.monthlySalary ?? null : null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/staff");
  return { success: true as const, staffId: staff.id };
}

export async function updateStaff(id: string, values: unknown) {
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
      ...(data.designation && { designation: data.designation }),
      ...(data.salaryType && { salaryType: data.salaryType }),
      ...(data.dailyWage !== undefined && { dailyWage: data.dailyWage }),
      ...(data.monthlySalary !== undefined && { monthlySalary: data.monthlySalary }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });
  revalidatePath("/staff");
  revalidatePath(`/staff/${id}`);
  return { success: true as const };
}

export async function updateAvailability(staffId: string, availability: "AVAILABLE" | "ON_JOB" | "ON_LEAVE" | "OFF_DUTY") {
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
