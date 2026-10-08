import { PageHeader } from "@/components/shared/page-header";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { NewInvoiceDialog } from "@/components/invoices/new-invoice-dialog";
import { getInvoiceList } from "@/server/invoices";
import { requireRole } from "@/lib/current-user";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";

export default async function InvoicesPage() {
  // ADMIN/ACCOUNTS/OPERATIONS only — same access list as Payments/Expenses;
  // Francis (SUPERVISOR) is deliberately excluded (2026-09-22 master prompt §25).
  await requireRole(["ADMIN", "ACCOUNTS"]);
  const list = await getInvoiceList();
  // Customer-facing invoice link (job token; only once the job is completed — the route 404s before that).
  const invoices = list.map(({ job, ...inv }) => ({
    ...inv,
    job: job ? { jobNumber: job.jobNumber } : null,
    customerUrl: job?.publicToken && job.status === "COMPLETED" ? `${PUBLIC_BOOKING_URL}/booking/invoice/${job.publicToken}` : null,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        description={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"} — auto-created on job completion, or create one directly`}
        actions={<NewInvoiceDialog />}
      />
      <InvoicesTable invoices={invoices} />
    </div>
  );
}
