import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { PaymentsExplorer } from "@/components/payments/payments-explorer";
import { NewPaymentDialog } from "@/components/payments/new-payment-dialog";
import { getAllPaymentsForList } from "@/server/payments";
import { getCompanySettings } from "@/server/settings";
import { computePaymentStatus } from "@/lib/payment-status";
import { formatINR } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";
import { PiggyBank, HandCoins, AlertTriangle, Wallet } from "lucide-react";
import { requireRole } from "@/lib/current-user";

export default async function PaymentsPage() {
// This page had NO session/role check at all before — it relied entirely
// on middleware's nav-based gate. Francis (SUPERVISOR) is not in
// ROLE_NAV_ACCESS for "payments"; this page-level guard now matches that
// explicitly, per the 2026-09-22 "enforce on route/page, not just
// middleware" requirement. Matches canAccessPayments in
// server/actions/payments.ts.
await requireRole(["ADMIN", "ACCOUNTS"]);
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
// "Advance Received" — money already collected on invoices that are only
// partially paid (an advance against the quote, balance still outstanding).
// Distinct from "Collected Today" (today's activity) and from a fully-paid
// invoice (that money is no longer an "advance", it's settled).
const advanceReceived = derived.filter((p) => p.live === "PARTIAL").reduce((s, p) => s + p.paidAmount, 0);
const overdueTotal = derived.filter((p) => p.live === "OVERDUE").reduce((s, p) => s + p.balance, 0);

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
<StatCard href="/payments?filter=partial" label="Advance Received" value={formatINR(advanceReceived)} icon={<PiggyBank className="size-4" />} tone="blue" />
<StatCard href="/payments?filter=overdue" label="Overdue" value={formatINR(overdueTotal)} icon={<AlertTriangle className="size-4" />} tone="destructive" />
</div>

<PaymentsExplorer payments={payments} paymentDetails={paymentDetails} />
</div>
);
}
