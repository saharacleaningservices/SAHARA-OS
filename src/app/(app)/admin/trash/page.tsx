import { PageHeader } from "@/components/shared/page-header";
import { TrashExplorer } from "@/components/admin/trash-explorer";
import { listTrash, countDemoData, type EntityType } from "@/server/audit";
import { requireRole } from "@/lib/current-user";

const ENTITY_TYPES: EntityType[] = ["Lead", "Job", "Staff", "Payment", "Expense"];

export default async function TrashPage() {
  await requireRole(["ADMIN"]);

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
