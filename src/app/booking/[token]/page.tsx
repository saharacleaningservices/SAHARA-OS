import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock, MapPin, Phone, Star, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { COMPANY, SERVICE_LABELS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/utils";
import { customerPaymentStatus, PAYMENT_STATUS_LABEL } from "@/server/booking-messages";
import { PayAfterServiceButton } from "@/components/public/pay-after-service-button";
import { BookingChangeRequest } from "@/components/public/booking-change-request";

// Customer-facing booking page, reached only through the unguessable token in
// the WhatsApp confirmation (never by the sequential job number). Shows the
// customer's own booking details and payment options — no staff, internal
// notes, internal pricing or other CRM data.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Booking — Sahara Cleaning Services", robots: { index: false, follow: false } };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Confirmed",
  ASSIGNED: "Confirmed",
  REACTIVATED: "Confirmed",
  ON_THE_WAY: "Team on the way",
  STARTED: "Service in progress",
  COMPLETED: "Completed",
  POSTPONED: "Rescheduled",
  CANCELLED: "Cancelled",
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  const { token } = await params;
  const { pay } = await searchParams;
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) notFound();

  const job = await db.job.findFirst({
    where: { publicToken: token, deletedAt: null },
    select: {
      jobNumber: true,
      customerName: true,
      service: true,
      scheduledDate: true,
      scheduledTime: true,
      area: true,
      status: true,
      jobValue: true,
      paymentPreference: true,
      advanceRequestedAt: true,
      payments: { where: { deletedAt: null }, select: { amount: true, paidAmount: true } },
    },
  });
  if (!job) notFound();

  const settings = await db.companySettings.findUnique({
    where: { id: "default" },
    select: { googleReviewUrl: true, upiId: true, upiQrUrl: true, bankName: true, bankAccountName: true, bankAccountNumber: true, bankIfsc: true },
  });
  const pmt = customerPaymentStatus(job);
  const open = job.status !== "CANCELLED" && job.status !== "COMPLETED";
  const showPay = pmt.due > 0 && job.status !== "CANCELLED";
  const hasPaymentDetails = !!(settings?.upiId || settings?.upiQrUrl || settings?.bankAccountNumber);
  const support = ["8956567130", "7083347130"];

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
          <h1 className="mt-2 text-lg font-bold text-[#0a2540]">Hi {job.customerName}</h1>
          <p className="text-sm text-[#0a2540]/70">Booking {job.jobNumber}</p>
          <span className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
        </div>

        <div className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
          <p className="font-semibold text-[#0a2540]">{SERVICE_LABELS[job.service] ?? job.service}</p>
          <p className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" /> {formatDate(job.scheduledDate)}</p>
          <p className="flex items-center gap-2"><Clock className="size-4 text-primary" /> {job.scheduledTime}</p>
          <p className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> {job.area}</p>
        </div>

        <div id="payment" className="space-y-3 rounded-2xl bg-white p-5 text-sm shadow-sm">
          <p className="flex items-center justify-between font-semibold text-[#0a2540]">
            <span className="flex items-center gap-2"><Wallet className="size-4 text-primary" /> Payment</span>
            <span className="rounded-full bg-[#0a2540]/5 px-2 py-0.5 text-xs">{PAYMENT_STATUS_LABEL[pmt.status]}</span>
          </p>
          {pmt.paid > 0 && <p>Received: {formatINR(pmt.paid)}</p>}
          {showPay && <p>Balance: <span className="font-semibold">{formatINR(pmt.due)}</span></p>}

          {showPay && (pay === "advance" || pmt.status !== "PAY_AFTER_SERVICE") && (
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="font-semibold">Pay Advance</p>
              {hasPaymentDetails ? (
                <>
                  {settings?.upiId && <p>UPI: <span className="font-medium">{settings.upiId}</span></p>}
                  {settings?.upiQrUrl && <img src={settings.upiQrUrl} alt="Scan to pay" className="h-40 w-40 rounded-md border bg-white object-contain" />}
                  {settings?.bankAccountNumber && (
                    <p>
                      Bank transfer — {settings.bankAccountName ?? COMPANY.name}, A/C {settings.bankAccountNumber}
                      {settings.bankIfsc ? `, IFSC ${settings.bankIfsc}` : ""}
                      {settings.bankName ? `, ${settings.bankName}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-[#0a2540]/70">
                    Please share the payment screenshot on WhatsApp. Your payment status updates once our team verifies it.
                  </p>
                </>
              ) : (
                <p>Our team will share payment details shortly.</p>
              )}
            </div>
          )}

          {showPay && open && pmt.status !== "PAY_AFTER_SERVICE" && pmt.paid === 0 && <PayAfterServiceButton token={token} />}
          {pmt.status === "PAY_AFTER_SERVICE" && (
            <p className="text-xs text-[#0a2540]/70">You'll pay after the service is completed, as per Sahara's booking terms.</p>
          )}
        </div>

        {job.status === "COMPLETED" && settings?.googleReviewUrl && (
          <a href={settings.googleReviewUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl bg-white p-5 text-sm shadow-sm">
            <span className="flex items-center gap-2 font-semibold"><Star className="size-4 text-amber-500" /> Rate us on Google</span>
            <span className="text-primary">Review →</span>
          </a>
        )}

        {open && (
          <div className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
            <p className="font-semibold text-[#0a2540]">Need a change?</p>
            <BookingChangeRequest token={token} />
          </div>
        )}

        <div className="rounded-2xl bg-white p-5 text-sm shadow-sm">
          <p className="font-semibold text-[#0a2540]">Important</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[#0a2540]/80">
            <li>Please keep water supply and electricity available.</li>
            <li>Arrange a stool / ladder where required.</li>
            <li>Need to change the date? Call or WhatsApp us.</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {support.map((n) => (
              <a key={n} href={`tel:+91${n}`} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold">
                <Phone className="size-3" /> {n}
              </a>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-[#0a2540]/60">{COMPANY.name}</p>
      </div>
    </div>
  );
}
