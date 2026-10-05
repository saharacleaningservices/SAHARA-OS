"use server";

// Apply the owner-approved Employee ID master (Super Admin only).
// Changes ONLY Staff.employeeCode + Staff.name on existing records, and the
// employee-code copies inside Job.teamSnapshot. Attendance, salary, loan,
// payment and Khata ledger rows reference staff by id and are never touched.
// Idempotent: records already on their master ID are skipped.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { EMPLOYEE_ID_MASTER } from "@/server/employee-id-master";

type Row = { code: string; name: string; staffId: string | null; currentCode: string | null; currentName: string | null; status: "UPDATE" | "DONE" | "AT_KHATA_IMPORT" | "MISSING" | "CONFLICT"; note?: string };

async function plan(): Promise<Row[]> {
  const ids = EMPLOYEE_ID_MASTER.map((e) => e.staffId).filter(Boolean) as string[];
  const [staff, holders] = await Promise.all([
    db.staff.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, employeeCode: true, name: true } }),
    db.staff.findMany({ where: { employeeCode: { in: EMPLOYEE_ID_MASTER.map((e) => e.code) } }, select: { id: true, employeeCode: true, name: true } }),
  ]);
  return EMPLOYEE_ID_MASTER.map((e) => {
    const holder = holders.find((h) => h.employeeCode === e.code);
    if (!e.staffId) {
      return holder
        ? { ...e, currentCode: holder.employeeCode, currentName: holder.name, status: "DONE" as const, note: "created by the Khata import" }
        : { ...e, currentCode: null, currentName: null, status: "AT_KHATA_IMPORT" as const, note: "ID is given when the Khata import creates this staff record" };
    }
    const s = staff.find((x) => x.id === e.staffId);
    if (!s) return { ...e, currentCode: null, currentName: null, status: "MISSING" as const, note: "staff record not found" };
    if (holder && holder.id !== s.id) return { ...e, currentCode: s.employeeCode, currentName: s.name, status: "CONFLICT" as const, note: `${e.code} already belongs to ${holder.name}` };
    const done = s.employeeCode === e.code && s.name === e.name;
    return { ...e, currentCode: s.employeeCode, currentName: s.name, status: done ? ("DONE" as const) : ("UPDATE" as const) };
  });
}

export async function previewEmployeeIdMaster() {
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Super Admin only" };
  return { rows: await plan() };
}

export async function applyEmployeeIdMaster() {
  const session = await getSession();
  if (session?.role !== "ADMIN") return { error: "Super Admin only" };
  const rows = await plan();
  const bad = rows.filter((r) => r.status === "MISSING" || r.status === "CONFLICT");
  if (bad.length) return { error: `Fix first: ${bad.map((r) => `${r.code} ${r.note}`).join("; ")}`, rows };
  const todo = rows.filter((r) => r.status === "UPDATE");
  const codeById = new Map(EMPLOYEE_ID_MASTER.filter((e) => e.staffId).map((e) => [e.staffId!, e.code]));

  let jobsUpdated = 0;
  await db.$transaction(async (tx) => {
    for (const r of todo) {
      await tx.staff.update({ where: { id: r.staffId! }, data: { employeeCode: r.code, name: r.name } });
      await tx.auditLog.create({
        data: {
          entityType: "Staff",
          entityId: r.staffId!,
          action: "EMPLOYEE_ID_MASTER",
          summary: `Employee ID ${r.currentCode} → ${r.code}${r.currentName !== r.name ? `; name "${r.currentName}" → "${r.name}"` : ""}`,
          actorName: session.name,
          actorEmail: session.email,
          meta: JSON.stringify({ from: { code: r.currentCode, name: r.currentName }, to: { code: r.code, name: r.name } }),
        },
      });
    }
    // Frozen job teams keep their historical names; only the code copy is refreshed.
    const jobs = await tx.job.findMany({ where: { teamSnapshot: { not: null } }, select: { id: true, teamSnapshot: true } });
    for (const j of jobs) {
      let team: { staffId: string; employeeCode?: string }[];
      try {
        team = JSON.parse(j.teamSnapshot!);
      } catch {
        continue;
      }
      if (!Array.isArray(team)) continue;
      let changed = false;
      for (const m of team) {
        const code = codeById.get(m.staffId);
        if (code && m.employeeCode !== code) {
          m.employeeCode = code;
          changed = true;
        }
      }
      if (changed) {
        await tx.job.update({ where: { id: j.id }, data: { teamSnapshot: JSON.stringify(team) } });
        jobsUpdated++;
      }
    }
  });
  revalidatePath("/staff");
  revalidatePath("/admin/khata-import");
  return { ok: true as const, updated: todo.length, jobsUpdated, rows: await plan() };
}
