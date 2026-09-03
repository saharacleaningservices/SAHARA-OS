import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ExpensesExplorer } from "@/components/expenses/expenses-explorer";
import { NewExpenseDialog } from "@/components/expenses/new-expense-dialog";
import { getAllExpensesForList } from "@/server/expenses";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { FlaskConical, Fuel, Wrench, HandCoins, Receipt } from "lucide-react";

const CATEGORY_ICON: Record<string, typeof FlaskConical> = {
  CHEMICALS: FlaskConical,
  FUEL: Fuel,
  EQUIPMENT: Wrench,
  STAFF_ADVANCE: HandCoins,
  MISCELLANEOUS: Receipt,
};

export default async function ExpensesPage() {
  const expenses = await getAllExpensesForList();
  const totals = Object.keys(EXPENSE_CATEGORY_LABELS).map((category) => ({
    category,
    total: expenses.filter((e) => e.category === category).reduce((s, e) => s + e.amount, 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={`${expenses.length} expenses tracked`}
        actions={<NewExpenseDialog />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {totals.map(({ category, total }) => {
          const Icon = CATEGORY_ICON[category];
          return (
            <StatCard key={category} label={EXPENSE_CATEGORY_LABELS[category]} value={formatINR(total)} icon={<Icon className="size-4" />} />
          );
        })}
      </div>

      <ExpensesExplorer expenses={expenses} />
    </div>
  );
}
