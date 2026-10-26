import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PackageCalculatorButton } from "@/components/layout/package-calculator-dialog";

/**
 * Francis (OPERATIONS) top bar — the same Package Calculator + New Lead as the
 * Super Admin / Accounts CRM bar, without the customer-database search
 * (Send Offer), which Operations is not permitted to use.
 * The calculator's server actions already scope him to his own leads and
 * list prices (no price/discount edits).
 */
export function OperationsActionsBar() {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card/60 px-4 py-2 sm:px-6">
      <PackageCalculatorButton />
      <Link
        href="/leads/new"
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40"
      >
        <UserPlus className="size-3.5 text-primary" /> New Lead
      </Link>
    </div>
  );
}
