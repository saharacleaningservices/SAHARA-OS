import { PageHeader } from "@/components/shared/page-header";
import { QuotationsTable } from "@/components/quotations/quotations-table";
import { getAllQuotations } from "@/server/quotations";
import { requireRole } from "@/lib/current-user";

export default async function QuotationsPage() {
  // ADMIN/ACCOUNTS/OPERATIONS only — matches ROLE_NAV_ACCESS's "quotations"
  // entry; Francis (SUPERVISOR) is deliberately excluded, same as Payments/
  // Expenses (2026-09-22 URL/architecture master prompt §23).
  await requireRole(["ADMIN", "ACCOUNTS", "OPERATIONS"]);
  const quotations = await getAllQuotations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description={`${quotations.length} quotation${quotations.length === 1 ? "" : "s"} — generate new ones from a Lead's detail page`}
      />
      <QuotationsTable quotations={quotations} />
    </div>
  );
}
