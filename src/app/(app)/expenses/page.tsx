import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ExpensesExplorer } from "@/components/expenses/expenses-explorer";
import { NewExpenseDialog } from "@/components/expenses/new-expense-dialog";
import { getAllExpensesForList } from "@/server/expenses";
import { getJobsForSelection } from "@/server/jobs";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { SprayCan, Fuel, Car, Wrench, Bike, HandCoins, Store, Receipt } from "lucide-react";

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
  const [expenses, jobOptions] = await Promise.all([getAllExpensesForList(), getJobsForSelection()]);
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
        actions={<NewExpenseDialog jobOptions={jobOptions} />}
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
