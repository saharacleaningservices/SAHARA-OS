import { PageHeader } from "@/components/shared/page-header";
import { TrashExplorer } from "@/components/admin/trash-explorer";
import { listTrash, countDemoData, type EntityType } from "@/server/audit";
import { requireRole } from "@/lib/current-user";
import { canSeeCustomerContact, canViewJobAmount } from "@/lib/permissions";

const ENTITY_TYPES: EntityType[] = ["Lead", "Job", "Staff", "Payment", "Expense"];

export default async function TrashPage() {
  // Trash: Super Admin + Accounts (full operational parity) — Audit Log
  // stays owner-only, but Trash/restore is part of Accounts' day-to-day
  // record management (see src/lib/permissions.ts canDeleteRecords).
  // SUPERVISOR (Francis) removed 2026-09-21 — Trash isn't part of his narrowed module list.
  const session = await requireRole(["ADMIN", "ACCOUNTS", "OPERATIONS"]);

  const [lists, demo] = await Promise.all([
    Promise.all(ENTITY_TYPES.map((t) => listTrash(t))),
    countDemoData(),
  ]);

  // Owner rule 2026-10-08: no customer numbers or amounts for restricted roles.
  const contact = canSeeCustomerContact(session.role);
  const money = canViewJobAmount(session.role);
  const clean = (rows: unknown[]) =>
    (rows as Record<string, unknown>[]).map((r) => ({
      ...r,
      ...(!contact && "mobile" in r ? { mobile: "" } : {}),
      ...(!contact && "clientMobile" in r ? { clientMobile: "" } : {}),
      ...(!money && "amount" in r ? { amount: 0 } : {}),
      ...(!money && "paidAmount" in r ? { paidAmount: 0 } : {}),
    }));
  const trash = Object.fromEntries(ENTITY_TYPES.map((t, i) => [t, clean(lists[i])])) as unknown as Record<
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
