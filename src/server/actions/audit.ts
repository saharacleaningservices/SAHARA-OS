"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { canManageDataSafety, canRestoreRecords } from "@/lib/permissions";
import { softDeleteMany, restoreMany, logAudit, type EntityType } from "@/server/audit";

const PATHS: Record<EntityType, string[]> = {
  Lead: ["/leads", "/dashboard"],
  Job: ["/jobs", "/dashboard"],
  Staff: ["/staff", "/dashboard"],
  Payment: ["/payments", "/dashboard", "/profit"],
  Expense: ["/expenses", "/dashboard", "/profit"],
};

function revalidateFor(entityType: EntityType) {
  for (const p of PATHS[entityType]) revalidatePath(p);
}

export async function bulkSoftDelete(entityType: EntityType, ids: string[]) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  if (ids.length === 0) return { error: "Nothing selected" };
  const count = await softDeleteMany(entityType, ids, session);
  revalidateFor(entityType);
  return { success: true as const, count };
}

export async function restoreRecord(entityType: EntityType, id: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  // Was gated to canManageDataSafety (Admin-only) — that's meant for bulk/
  // destructive data-safety actions ("delete all demo data"), not for
  // undoing a single accidental delete. This silently blocked Accounts
  // (and now Operations/Supervisor) from ever actually restoring anything
  // despite Trash being listed as part of their access — see
  // canRestoreRecords in src/lib/permissions.ts.
  if (!canRestoreRecords(session.role)) return { error: "Not authorized to restore records" };
  await restoreMany(entityType, [id], session);
  revalidateFor(entityType);
  revalidatePath("/admin/trash");
  return { success: true as const };
}

export async function bulkRestore(entityType: EntityType, ids: string[]) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  if (!canRestoreRecords(session.role)) return { error: "Not authorized to restore records" };
  const count = await restoreMany(entityType, ids, session);
  revalidateFor(entityType);
  revalidatePath("/admin/trash");
  return { success: true as const, count };
}

/** Admin-only: soft-delete every row flagged as demo/seed data in one action. */
export async function deleteAllDemoData() {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  if (!canManageDataSafety(session.role)) return { error: "Admin only" };

  let total = 0;

  const demoStaff = await db.staff.findMany({ where: { isDemo: true, deletedAt: null }, select: { id: true } });
  if (demoStaff.length) total += await softDeleteMany("Staff", demoStaff.map((r) => r.id), session);

  const demoJobs = await db.job.findMany({ where: { isDemo: true, deletedAt: null }, select: { id: true } });
  if (demoJobs.length) total += await softDeleteMany("Job", demoJobs.map((r) => r.id), session);

  const demoPayments = await db.payment.findMany({ where: { isDemo: true, deletedAt: null }, select: { id: true } });
  if (demoPayments.length) total += await softDeleteMany("Payment", demoPayments.map((r) => r.id), session);

  const demoExpenses = await db.expense.findMany({ where: { isDemo: true, deletedAt: null }, select: { id: true } });
  if (demoExpenses.length) total += await softDeleteMany("Expense", demoExpenses.map((r) => r.id), session);

  await logAudit({
    entityType: "Job",
    entityId: "demo-cleanup",
    action: "BULK_DELETE",
    summary: `Deleted all demo data (${total} records)`,
    session,
  });

  revalidatePath("/staff");
  revalidatePath("/jobs");
  revalidatePath("/payments");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/admin/trash");
  return { success: true as const, total };
}
