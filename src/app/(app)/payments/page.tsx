import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { PaymentsExplorer } from "@/components/payments/payments-explorer";
import { NewPaymentDialog } from "@/components/payments/new-payment-dialog";
import { getAllPaymentsForList } from "@/server/payments";
import { computePaymentStatus } from "@/lib/payment-status";
import { formatINR } from "@/lib/utils";
import { CheckCircle2, Clock, AlertTriangle, Wallet } from "lucide-react";

export default async function PaymentsPage() {
  const payments = await getAllPaymentsForList();
  const withStatus = payments.map((p) => ({ ...p, liveStatus: computePaymentStatus(p.dueDate, p.status) }));

  const paidTotal = withStatus.filter((p) => p.liveStatus === "PAID").reduce((s, p) => s + p.paidAmount, 0);
  const dueSoonTotal = withStatus.filter((p) => p.liveStatus === "DUE_SOON").reduce((s, p) => s + p.amount, 0);
  const overdueTotal = withStatus.filter((p) => p.liveStatus === "OVERDUE").reduce((s, p) => s + p.amount, 0);
  const pendingTotal = withStatus.filter((p) => p.liveStatus === "PENDING").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Recovery"
        description="Track invoices, follow up on dues, and stay ahead of overdue payments."
        actions={<NewPaymentDialog />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Paid (all time)" value={formatINR(paidTotal)} icon={<CheckCircle2 className="size-4" />} tone="success" />
        <StatCard label="Due Soon" value={formatINR(dueSoonTotal)} icon={<Clock className="size-4" />} tone="warning" />
        <StatCard label="Overdue" value={formatINR(overdueTotal)} icon={<AlertTriangle className="size-4" />} tone="destructive" />
        <StatCard label="Pending" value={formatINR(pendingTotal)} icon={<Wallet className="size-4" />} />
      </div>

      <PaymentsExplorer payments={payments} />
    </div>
  );
}
