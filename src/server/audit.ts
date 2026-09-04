import { db } from "@/lib/db";
import type { SessionPayload } from "@/lib/session";

export type EntityType = "Lead" | "Job" | "Staff" | "Payment" | "Expense";

export const ENTITY_LABELS: Record<EntityType, string> = {
  Lead: "lead",
  Job: "job",
  Staff: "staff member",
  Payment: "payment",
  Expense: "expense",
};

export async function logAudit(input: {
  entityType: EntityType | "Backup";
  entityId: string;
  action: string;
  summary: string;
  session?: SessionPayload | null;
  meta?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary,
      actorName: input.session?.name ?? null,
      actorEmail: input.session?.email ?? null,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    },
  });
}

/** Soft-deletes (mode "delete") or un-deletes (mode "restore") a batch of rows. */
async function applySoftDelete(entityType: EntityType, ids: string[], mode: "delete" | "restore", actorName: string | null) {
  const isDelete = mode === "delete";
  const where = isDelete ? { id: { in: ids }, deletedAt: null } : { id: { in: ids } };
  const data = { deletedAt: isDelete ? new Date() : null, deletedByName: isDelete ? actorName : null };
  switch (entityType) {
    case "Lead":
      return db.lead.updateMany({ where, data });
    case "Job":
      return db.job.updateMany({ where, data });
    case "Staff":
      return db.staff.updateMany({ where, data });
    case "Payment":
      return db.payment.updateMany({ where, data });
    case "Expense":
      return db.expense.updateMany({ where, data });
  }
}

export async function softDeleteMany(entityType: EntityType, ids: string[], session: SessionPayload) {
  if (ids.length === 0) return 0;
  const res = await applySoftDelete(entityType, ids, "delete", session.name);
  await logAudit({
    entityType,
    entityId: ids.length === 1 ? ids[0] : `${ids.length}-records`,
    action: ids.length === 1 ? "DELETE" : "BULK_DELETE",
    summary:
      ids.length === 1
        ? `Deleted 1 ${ENTITY_LABELS[entityType]}`
        : `Bulk-deleted ${ids.length} ${ENTITY_LABELS[entityType]}s`,
    session,
    meta: { ids },
  });
  return res.count;
}

export async function restoreMany(entityType: EntityType, ids: string[], session: SessionPayload) {
  if (ids.length === 0) return 0;
  const res = await applySoftDelete(entityType, ids, "restore", null);
  await logAudit({
    entityType,
    entityId: ids.length === 1 ? ids[0] : `${ids.length}-records`,
    action: ids.length === 1 ? "RESTORE" : "BULK_RESTORE",
    summary:
      ids.length === 1
        ? `Restored 1 ${ENTITY_LABELS[entityType]}`
        : `Bulk-restored ${ids.length} ${ENTITY_LABELS[entityType]}s`,
    session,
    meta: { ids },
  });
  return res.count;
}

export async function listTrash(entityType: EntityType) {
  const where = { deletedAt: { not: null } } as const;
  const orderBy = { deletedAt: "desc" } as const;
  const take = 200;
  switch (entityType) {
    case "Lead":
      return db.lead.findMany({
        where,
        select: { id: true, leadNumber: true, name: true, mobile: true, deletedAt: true, deletedByName: true },
        orderBy,
        take,
      });
    case "Job":
      return db.job.findMany({
        where,
        select: { id: true, jobNumber: true, customerName: true, deletedAt: true, deletedByName: true },
        orderBy,
        take,
      });
    case "Staff":
      return db.staff.findMany({
        where,
        select: { id: true, employeeCode: true, name: true, deletedAt: true, deletedByName: true },
        orderBy,
        take,
      });
    case "Payment":
      return db.payment.findMany({
        where,
        select: { id: true, invoiceNumber: true, clientName: true, deletedAt: true, deletedByName: true },
        orderBy,
        take,
      });
    case "Expense":
      return db.expense.findMany({
        where,
        select: { id: true, description: true, amount: true, deletedAt: true, deletedByName: true },
        orderBy,
        take,
      });
  }
}

export async function listAuditLog(limit = 100) {
  return db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export async function countDemoData() {
  const [staff, jobs, payments, expenses] = await Promise.all([
    db.staff.count({ where: { isDemo: true, deletedAt: null } }),
    db.job.count({ where: { isDemo: true, deletedAt: null } }),
    db.payment.count({ where: { isDemo: true, deletedAt: null } }),
    db.expense.count({ where: { isDemo: true, deletedAt: null } }),
  ]);
  return { staff, jobs, payments, expenses, total: staff + jobs + payments + expenses };
}
