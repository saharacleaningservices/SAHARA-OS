import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ExpensesExplorer } from "@/components/expenses/expenses-explorer";
import { NewExpenseDialog } from "@/components/expenses/new-expense-dialog";
import { getAllExpensesForList } from "@/server/expenses";
import { getJobsForSelection } from "@/server/jobs";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { SprayCan, Fuel, Car, Wrench, Bike, HandCoins, Store, Receipt } from "lucide-react";
import { requireRole } from "@/lib/current-user";
import { db } from "@/lib/db";

const CATEGORY_ICON: Record<string, typeof Receipt> = {
  HOUSEKEEPING_MATERIAL: SprayCan,
  FUEL: Fuel,
  AUTO_CAB_FARE: Car,
  EQUIPMENT: Wrench,
  BIKE_SERVICE: Bike,
  STAFF_ADVANCE: HandCoins,
  VENDOR_PAYMENT: Store,
  MISCELLANEOUS: Receipt,
};

export default async function ExpensesPage() {
  // This page had NO session/role check at all before — it relied entirely
  // on middleware's nav-based gate. Francis (SUPERVISOR) is not in
  // ROLE_NAV_ACCESS for "expenses"; this page-level guard now matches that
  // explicitly, per the 2026-09-22 "enforce on route/page, not just
  // middleware" requirement. Matches canAccessExpenses in
  // server/actions/expenses.ts.
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const [expenses, jobOptions, staffOptions] = await Promise.all([
    getAllExpensesForList(),
    getJobsForSelection(),
    db.staff.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, employeeCode: true } }),
  ]);
  // Show a tile for every current category, plus any legacy category that
  // still has spend recorded against it.
  const legacyWithSpend = [...new Set(expenses.map((e) => e.category))].filter(
    (c) => !(EXPENSE_CATEGORIES as readonly string[]).includes(c),
  );
  const totals = [...EXPENSE_CATEGORIES, ...legacyWithSpend].map((category) => ({
    category,
    total: expenses.filter((e) => e.category === category).reduce((s, e) => s + e.amount, 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={`${expenses.length} expenses tracked`}
        actions={<NewExpenseDialog jobOptions={jobOptions} staffOptions={staffOptions} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {totals.map(({ category, total }) => {
          const Icon = CATEGORY_ICON[category] ?? Receipt;
          return (
            <StatCard key={category} label={EXPENSE_CATEGORY_LABELS[category] ?? category} value={formatINR(total)} icon={<Icon className="size-4" />} />
          );
        })}
      </div>

      <ExpensesExplorer expenses={expenses} />
    </div>
  );
}
