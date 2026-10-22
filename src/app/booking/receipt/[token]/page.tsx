import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { COMPANY, SERVICE_LABELS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/utils";
import { customerPaymentStatus } from "@/server/booking-messages";

// /booking/receipt/{Job.publicToken} — the "View Receipt" button of sahara_payment_received_v1. Same unguessable-token
// validation as /booking/{token}; shows only what the customer paid, never internal notes or staff data.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Payment Receipt — Sahara Cleaning Services", robots: { index: false, follow: false } };

const MODE_LABEL: Record<string, string> = { UPI: "UPI", QR: "UPI / QR", BANK: "Bank transfer", CASH: "Cash" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();
  const job = await db.job.findFirst({
    where: { publicToken: token, deletedAt: null },
    select: {
      jobNumber: true, customerName: true, service: true, scheduledDate: true, scheduledTime: true, area: true,
      jobValue: true, paymentPreference: true, advanceRequestedAt: true,
      payments: { where: { deletedAt: null, paidAmount: { gt: 0 } }, orderBy: { paidDate: "asc" }, select: { amount: true, paidAmount: true, paidDate: true, mode: true } },
    },
  });
  if (!job || job.payments.length === 0) notFound(); // no payment recorded → no receipt
  const pmt = customerPaymentStatus(job);
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <header className="border-b pb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Payment Receipt</p>
          <h1 className="text-lg font-bold">{COMPANY.name}</h1>
        </header>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Booking ID</dt><dd className="font-medium">{job.jobNumber}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Customer</dt><dd className="font-medium">{job.customerName}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Service</dt><dd className="font-medium">{SERVICE_LABELS[job.service] ?? job.service}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Service date</dt><dd className="font-medium">{formatDate(job.scheduledDate)}, {job.scheduledTime}</dd></div>
        </dl>
        <div className="space-y-2 border-t pt-3 text-sm">
          {job.payments.map((p, i) => (
            <div key={i} className="flex justify-between">
              <span>{p.paidDate ? formatDate(p.paidDate) : "Received"} · {p.mode ? (MODE_LABEL[p.mode] ?? p.mode) : "Payment"}</span>
              <span className="font-semibold">{formatINR(p.paidAmount ?? 0)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Total received</span><span className="font-bold">{formatINR(pmt.paid)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Balance due</span><span className="font-bold">{formatINR(pmt.due)}</span></div>
        </div>
        <p className="text-center text-xs text-muted-foreground">Thank you for choosing Sahara Cleaning Services. Helpline: 7083347130 / 8956567130</p>
      </div>
    </main>
  );
}
