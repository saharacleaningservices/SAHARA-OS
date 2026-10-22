import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PackageCalculatorButton } from "@/components/layout/package-calculator-dialog";
import { requireUser } from "@/lib/current-user";
import { canAccess } from "@/lib/constants";

// Operations → Quick Quote Generator: the existing Package Calculator as its own menu destination (it was only a dialog
// on the action bars). Same component, same server-side access rules (getPackageCalculatorAccess) — nothing new priced here.
export const dynamic = "force-dynamic";

export default async function QuickQuotePage() {
  const session = await requireUser();
  if (!canAccess(session.role, "jobs")) redirect("/dashboard");
  return (
    <div className="space-y-4">
      <PageHeader
        title="Quick Quote Generator"
        description="Pick the package and add-ons, see the live price, then save it to a lead or share it on WhatsApp."
      />
      <PackageCalculatorButton variant="button" label="Open Quick Quote Generator" defaultOpen />
    </div>
  );
}
