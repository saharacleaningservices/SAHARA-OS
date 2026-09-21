import { PageHeader } from "@/components/shared/page-header";
import { TrashExplorer } from "@/components/admin/trash-explorer";
import { listTrash, countDemoData, type EntityType } from "@/server/audit";
import { requireRole } from "@/lib/current-user";

const ENTITY_TYPES: EntityType[] = ["Lead", "Job", "Staff", "Payment", "Expense"];

export default async function TrashPage() {
  // Trash: Super Admin + Accounts (full operational parity) — Audit Log
  // stays owner-only, but Trash/restore is part of Accounts' day-to-day
  // record management (see src/lib/permissions.ts canDeleteRecords).
  await requireRole(["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"]);

  const [lists, demo] = await Promise.all([
    Promise.all(ENTITY_TYPES.map((t) => listTrash(t))),
    countDemoData(),
  ]);

  const trash = Object.fromEntries(ENTITY_TYPES.map((t, i) => [t, lists[i]])) as unknown as Record<
    EntityType,
    Array<Record<string, unknown> & { id: string; deletedAt: string | Date | null; deletedByName: string | null }>
  >;

  return (
    <div className="space-y-6">
      <PageHeader title="Trash" description="Soft-deleted records. Nothing is erased until you say so." />
      <TrashExplorer trash={trash} demoCount={demo.total} />
    </div>
  );
}
