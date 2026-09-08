import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { PaymentsExplorer } from "@/components/payments/payments-explorer";
import { NewPaymentDialog } from "@/components/payments/new-payment-dialog";
import { getAllPaymentsForList } from "@/server/payments";
import { getCompanySettings } from "@/server/settings";
import { computePaymentStatus } from "@/lib/payment-status";
import { formatINR } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";
import { CheckCircle2, HandCoins, AlertTriangle, Wallet } from "lucide-react";

export default async function PaymentsPage() {
  const [payments, settings] = await Promise.all([getAllPaymentsForList(), getCompanySettings()]);
  const now = new Date();
  const t0 = startOfDay(now);
  const t1 = endOfDay(now);

  const derived = payments.map((p) => {
    const paid = p.status === "PAID" || p.paidAmount >= p.amount - 0.01;
    const partial = !paid && p.paidAmount > 0;
    const live = paid ? "PAID" : partial ? "PARTIAL" : computePaymentStatus(p.dueDate, p.status);
    return { ...p, live, balance: Math.max(p.amount - p.paidAmount, 0) };
  });

  const pendingCollection = derived.filter((p) => p.live !== "PAID").reduce((s, p) => s + p.balance, 0);
  const collectedToday = derived
    .filter((p) => p.paidDate && p.paidDate >= t0 && p.paidDate <= t1)
    .reduce((s, p) => s + p.paidAmount, 0);
  const overdueTotal = derived.filter((p) => p.live === "OVERDUE").reduce((s, p) => s + p.balance, 0);
  const paidTotal = derived.filter((p) => p.live === "PAID").reduce((s, p) => s + p.paidAmount, 0);

  const paymentDetails = {
    upiId: settings.upiId ?? null,
    upiQrUrl: settings.upiQrUrl ?? null,
    bankName: settings.bankName ?? null,
    bankAccountName: settings.bankAccountName ?? null,
    bankAccountNumber: settings.bankAccountNumber ?? null,
    bankIfsc: settings.bankIfsc ?? null,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments & Collection"
        description="Advance, balance and collections across every booking, lead and job."
        actions={<NewPaymentDialog />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard href="/payments?filter=pending" label="Pending Collection" value={formatINR(pendingCollection)} icon={<Wallet className="size-4" />} tone="warning" />
        <StatCard href="/payments?filter=paid" label="Collected Today" value={formatINR(collectedToday)} icon={<HandCoins className="size-4" />} tone="success" />
        <StatCard href="/payments?filter=overdue" label="Overdue" value={formatINR(overdueTotal)} icon={<AlertTriangle className="size-4" />} tone="destructive" />
        <StatCard href="/payments?filter=paid" label="Paid (all time)" value={formatINR(paidTotal)} icon={<CheckCircle2 className="size-4" />} tone="success" />
      </div>

      <PaymentsExplorer payments={payments} paymentDetails={paymentDetails} />
    </div>
  );
}
