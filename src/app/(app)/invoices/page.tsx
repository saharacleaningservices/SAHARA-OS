import { PageHeader } from "@/components/shared/page-header";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { NewInvoiceDialog } from "@/components/invoices/new-invoice-dialog";
import { getInvoiceList } from "@/server/invoices";
import { requireRole } from "@/lib/current-user";

export default async function InvoicesPage() {
  // ADMIN/ACCOUNTS/OPERATIONS only — same access list as Payments/Expenses;
  // Francis (SUPERVISOR) is deliberately excluded (2026-09-22 master prompt §25).
  await requireRole(["ADMIN", "ACCOUNTS", "OPERATIONS"]);
  const invoices = await getInvoiceList();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"} — auto-created on job completion, or create one directly`}
        actions={<NewInvoiceDialog />}
      />
      <InvoicesTable invoices={invoices} />
    </div>
  );
}
