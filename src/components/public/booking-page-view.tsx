import { notFound } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock, FileText, MapPin, Phone, Star, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { COMPANY, SERVICE_LABELS } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/utils";
import { customerPaymentStatus, PAYMENT_STATUS_LABEL } from "@/server/booking-messages";
import { PayAfterServiceButton } from "@/components/public/pay-after-service-button";
import { BookingChangeRequest } from "@/components/public/booking-change-request";
import { ConfirmCompletedButton } from "@/components/public/confirm-completed-button";
import { PackageScopeCard } from "@/components/shared/package-scope-card";
import { CustomerDocument } from "@/components/public/customer-document";
import { DocActionBar } from "@/components/public/doc-action-bar";
import { socialLinks } from "@/lib/social-links";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { UPI_QR_OPTIONS, upiPayUri } from "@/lib/upi";
import { paymentSplit } from "@/lib/booking-payment";
import { getCatalogEntryForJob } from "@/server/service-catalog";
import QRCode from "qrcode";

// Customer-facing booking page body, reached only through the unguessable token in
// the WhatsApp confirmation (never by the sequential job number). Shows the
// customer's own booking details and payment options — no staff, internal
// notes, internal pricing or other CRM data.


// Customer-facing statuses only: Confirmed → Scheduled → Rescheduled / Cancelled (→ Completed).
// "On the way" and "Started" are internal Staff/Operations steps and are never shown here.
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Confirmed",
  REACTIVATED: "Confirmed",
  ASSIGNED: "Scheduled",
  ON_THE_WAY: "Scheduled",
  STARTED: "Scheduled",
  COMPLETED: "Completed",
  POSTPONED: "Rescheduled",
  CANCELLED: "Cancelled",
};

/** Google Calendar "add event" link for the CURRENT date/time (re-add after a reschedule). */
function calendarHref(job: { jobNumber: string; scheduledDate: Date; scheduledTime: string; address: string | null; area: string | null }, service: string) {
  const ymd = new Date(job.scheduledDate.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
  const m = job.scheduledTime.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  let dates = `${ymd}/${ymd}`;
  if (m) {
    let h = Number(m[1]) % 12;
    if (/pm/i.test(m[3])) h += 12;
    const start = `${ymd}T${String(h).padStart(2, "0")}${m[2] ?? "00"}00`;
    const end = `${ymd}T${String(Math.min(h + 2, 23)).padStart(2, "0")}${m[2] ?? "00"}00`;
    dates = `${start}/${end}`;
  }
  const q = new URLSearchParams({ action: "TEMPLATE", text: `Sahara Cleaning — ${service} (${job.jobNumber})`, dates, ctz: "Asia/Kolkata", location: job.address || job.area || "" });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/**
 * The secure customer booking page body, shared by three routes that all use
 * the same unguessable Job.publicToken and the same validation:
 *   /booking/{token}            — booking page (unchanged behaviour)
 *   /booking/quotation/{token}  — opens with "Your Quotation" first
 *   /booking/pay/{token}        — opens with the payment section first
 * An invalid or unknown token is always a plain 404 — nothing is revealed.
 */
export async function BookingPageView({ token, pay, focus }: { token: string; pay?: string; focus?: "quotation" | "pay" | "invoice" }) {
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
      address: true,
      packageName: true,
      serviceVariant: true,
      comboServices: true,
      status: true,
      jobValue: true,
      paymentPreference: true,
      advanceRequestedAt: true,
      serviceItems: true,
      discountAmount: true,
      customerMobile: true,
      scopeOfWork: true,
      festivalName: true,
      createdAt: true,
      completedAt: true,
      gstEnabled: true,
      gstAmount: true,
      customerGstin: true,
      lead: { select: { quotations: { orderBy: { createdAt: "desc" }, take: 1, select: { quoteNumber: true } } } },
      invoice: { select: { invoiceNumber: true } },
      payments: { where: { deletedAt: null }, select: { amount: true, paidAmount: true } },
    },
  });
  if (!job) notFound();
  // The final invoice exists only once the job is completed.
  if (focus === "invoice" && job.status !== "COMPLETED") notFound();

  const settings = await db.companySettings.findUnique({
    where: { id: "default" },
    select: {
      googleReviewUrl: true, upiId: true, upiQrUrl: true,
      name: true, phone: true, email: true, address: true, website: true, logoUrl: true,
    },
  });
  const pmt = customerPaymentStatus(job);
  const open = job.status !== "CANCELLED" && job.status !== "COMPLETED";
  const showPay = pmt.due > 0 && job.status !== "CANCELLED";
  const hasPaymentDetails = !!(settings?.upiId || settings?.upiQrUrl);
  const support = ["8956567130", "7083347130"];
  // Dynamic UPI QR for the exact balance (PhonePe / GPay / any UPI app scan it) — documents only.
  let upiQrDataUrl: string | null = null;
  const split = paymentSplit(job.jobValue);
  const advanceDue = pmt.status === "PAY_AFTER_SERVICE" ? 0 : Math.min(pmt.due, Math.max(0, Math.round((split.advance - pmt.paid) * 100) / 100));
  const payNowAmount = focus === "pay" && advanceDue > 0 ? advanceDue : pmt.due;
  const upiUri = settings?.upiId && pmt.due > 0 ? upiPayUri({ upiId: settings.upiId, payeeName: settings.name || COMPANY.name, amount: payNowAmount }) : null;
  if ((focus === "invoice" || focus === "quotation" || focus === "pay") && upiUri) {
    try {
      upiQrDataUrl = await QRCode.toDataURL(upiUri, UPI_QR_OPTIONS);
    } catch {
      upiQrDataUrl = null;
    }
  }
  // Reference IDs and (quotation only) the Service Catalog wording — read from the database, never retyped.
  const customer = focus === "invoice" || focus === "quotation" ? await db.customer.findFirst({ where: { mobile: job.customerMobile }, select: { customerNumber: true } }) : null;
  const catalogEntry = focus === "quotation" ? await getCatalogEntryForJob({ service: job.service, packageName: job.packageName, serviceVariant: job.serviceVariant }) : null;
  let included: string[] = [];
  try {
    const v = job.comboServices ? JSON.parse(job.comboServices) : [];
    included = Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    included = [];
  }

  const docView = focus === "quotation" || focus === "invoice";
  const paymentBlock = (
        <div id="payment" className="space-y-3 rounded-2xl bg-white p-5 text-sm shadow-sm">
          <p className="flex items-center justify-between font-semibold text-[#0a2540]">
            <span className="flex items-center gap-2"><Wallet className="size-4 text-primary" /> Payment</span>
            <span className="rounded-full bg-[#0a2540]/5 px-2 py-0.5 text-xs">{PAYMENT_STATUS_LABEL[pmt.status]}</span>
          </p>
          {job.jobValue > 0 && <p>Total price: <span className="font-semibold">{formatINR(job.jobValue)}</span></p>}
          {pmt.paid > 0 && <p>Received: {formatINR(pmt.paid)}</p>}
          {showPay && <p>Balance: <span className="font-semibold">{formatINR(pmt.due)}</span></p>}

          {showPay && (pay === "advance" || focus === "pay" || pmt.status !== "PAY_AFTER_SERVICE") && (
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="font-semibold">Pay Advance</p>
              {hasPaymentDetails ? (
                <>
                  {settings?.upiId && <p>UPI: <span className="font-medium">{settings.upiId}</span></p>}
                  {upiQrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={upiQrDataUrl} alt={`Scan to pay ${formatINR(pmt.due)}`} className="h-44 w-44 rounded-md border bg-white object-contain" />
                  ) : (
                    settings?.upiQrUrl && <img src={settings.upiQrUrl} alt="Scan to pay" className="h-40 w-40 rounded-md border bg-white object-contain" />
                  )}
                  {upiUri && (
                    <a href={upiUri} className="flex min-h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
                      Pay {formatINR(pmt.due)} with PhonePe / GPay / any UPI app
                    </a>
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
  );

  if (focus === "pay") {
    const nothingDue = pmt.due <= 0 || job.status === "CANCELLED";
    return (
      <main className="theme-navy flex min-h-[100dvh] items-center justify-center bg-[#f4f7fb] px-4 py-4">
        <section className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 text-[#0a2540] shadow-lg" aria-label="Pay advance">
          <header className="space-y-1 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Pay Advance</p>
            <p className="text-xs font-semibold text-[#0a2540]/60">Payable amount</p>
            <p className="text-4xl font-black tabular-nums" aria-label="Payable amount">{formatINR(payNowAmount)}</p>
          </header>
          {nothingDue ? (
            <p className="rounded-xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">{job.status === "CANCELLED" ? "This booking is cancelled." : "Payment received in full — thank you."}</p>
          ) : (
            <div className="space-y-2 text-center">
              {upiQrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={upiQrDataUrl} alt={`Scan to pay ${formatINR(payNowAmount)}`} className="mx-auto size-48 rounded-xl border bg-white object-contain" />
              ) : settings?.upiQrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.upiQrUrl} alt="Scan to pay" className="mx-auto size-48 rounded-xl border bg-white object-contain" />
              ) : (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Our team will share payment details shortly.</p>
              )}
              {upiUri && (
                <a href={upiUri} className="flex min-h-12 items-center justify-center rounded-2xl bg-primary px-3 text-sm font-extrabold text-primary-foreground">
                  Pay {formatINR(payNowAmount)} with any UPI app
                </a>
              )}
            </div>
          )}
        </section>
      </main>
    );
  }

  const docCompany = {
              name: settings?.name || COMPANY.name,
              phone: settings?.phone || COMPANY.phones[0],
              email: settings?.email || COMPANY.email,
              address: settings?.address || COMPANY.address,
              website: settings?.website ?? COMPANY.website,
              logoUrl: settings?.logoUrl ?? "/brand/sahara-logo.png",
              upiId: settings?.upiId ?? null,
              upiQrUrl: settings?.upiQrUrl ?? null,
              bankName: null,
              bankAccountName: null,
              bankAccountNumber: null,
              bankIfsc: null,
              upiQrDataUrl,
              payUrl: `${PUBLIC_BOOKING_URL}/booking/pay/${token}`,
            };
  const docJob = {
              jobNumber: job.jobNumber,
              customerName: job.customerName,
              customerMobile: job.customerMobile,
              address: job.address,
              area: job.area,
              serviceLabel: SERVICE_LABELS[job.service] ?? job.service,
              packageName: job.packageName,
              serviceVariant: job.serviceVariant,
              included,
              serviceItems: job.serviceItems,
              discountAmount: job.discountAmount,
              jobValue: job.jobValue,
              scopeOfWork: job.scopeOfWork,
              scheduledDate: job.scheduledDate,
              scheduledTime: job.scheduledTime,
              createdAt: job.createdAt,
              completedAt: job.completedAt,
              festivalName: job.festivalName,
              paid: pmt.paid,
              invoiceNumber: job.invoice?.invoiceNumber ?? null,
              gstEnabled: job.gstEnabled,
              gstAmount: job.gstAmount,
              customerGstin: job.customerGstin,
              customerNumber: customer?.customerNumber ?? null,
              quotationNumber: job.lead?.quotations[0]?.quoteNumber ?? null,
            };
  if (docView) {
    // Quotation / invoice view (owner 2026-10-25). Layout model: BOX MODEL — one fixed A4-width sheet (794 px) in the
    // brand blue, no extra footers or inline download buttons; everything the customer can do sits in the sticky bar.
    const kind = focus === "invoice" ? "INVOICE" : "QUOTATION";
    const social = socialLinks("footer");
    const href = (k: string) => social.find((x) => x.key === k)?.href ?? "#";
    const payAdvance = advanceDue > 0;
    const payBtn = pmt.due > 0 && job.status !== "CANCELLED" && kind === "QUOTATION" ? { label: payAdvance ? `Pay Advance ${formatINR(advanceDue)}` : `Pay Now ${formatINR(pmt.due)}`, href: `/booking/pay/${token}` } : null;
    return (
      <div className="theme-sahara-blue min-h-screen bg-[#eef2fb] px-2 pb-36 pt-4 print:bg-white print:p-0">
        <div className="mx-auto w-full max-w-[794px]">
          <CustomerDocument
            kind={kind}
            shareUrl={`${PUBLIC_BOOKING_URL}/booking/${focus}/${token}`}
            catalog={catalogEntry ? { name: catalogEntry.name, scope: catalogEntry.scopeOfWork, equipment: catalogEntry.equipmentsUsed, terms: catalogEntry.termsConditions } : null}
            company={docCompany}
            job={docJob}
          />
        </div>
        <DocActionBar
          kind={kind}
          token={token}
          pay={payBtn}
          canChange={kind === "QUOTATION" && open}
          pdfHref={`/booking/invoice/${token}/pdf?download=1`}
          shareText={`Sahara Cleaning Services — your invoice ${job.invoice?.invoiceNumber ?? job.jobNumber}: ${PUBLIC_BOOKING_URL}/booking/invoice/${token}`}
          socials={{ instagram: href("instagram"), facebook: href("facebook"), youtube: href("youtube"), review: `${PUBLIC_BOOKING_URL}/review` }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] px-4 py-8 print:bg-white print:p-0">
      <div className={`mx-auto space-y-4 ${focus === "quotation" || focus === "invoice" ? "max-w-3xl" : "max-w-md"}`}>
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm print:hidden">
          <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
          <h1 className="mt-2 text-lg font-bold text-[#0a2540]">Hi {job.customerName}</h1>
          <p className="text-sm text-[#0a2540]/70">Booking {job.jobNumber}</p>
          <span className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            {STATUS_LABEL[job.status] ?? job.status}
          </span>
        </div>

        <div className="space-y-4 print:hidden">

        {/* Quotation / invoice view: the document above already carries the service, schedule,
            scope, terms and payment details — keep the page short (change request right under it). */}
        {job.status === "STARTED" && <ConfirmCompletedButton token={token} />}

        {docView && open && (
          <div className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
            <p className="font-semibold text-[#0a2540]">Need a change?</p>
            <BookingChangeRequest token={token} />
          </div>
        )}

        {!docView && (
        <div className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
          <p className="font-semibold text-[#0a2540]">{SERVICE_LABELS[job.service] ?? job.service}</p>
          {(job.packageName || job.serviceVariant) && (
            <p>
              Package: <span className="font-semibold">{job.packageName || job.serviceVariant}</span>
              {job.packageName && job.serviceVariant ? ` · ${job.serviceVariant}` : ""}
            </p>
          )}
          <p className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" /> {formatDate(job.scheduledDate)}</p>
          <p className="flex items-center gap-2"><Clock className="size-4 text-primary" /> {job.scheduledTime}</p>
          {open && (
            <a href={calendarHref(job, SERVICE_LABELS[job.service] ?? job.service)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary">
              <CalendarDays className="size-3.5" /> Add / update in my calendar
            </a>
          )}
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> {job.address || job.area}</p>
          {(
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={`/booking/quotation/${token}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-white">
                <FileText className="size-3.5" /> View Quotation
              </a>
              {job.status === "COMPLETED" && (
                <a href={`/booking/invoice/${token}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-primary/40 px-3 text-xs font-bold text-primary">
                  <FileText className="size-3.5" /> View Final Invoice
                </a>
              )}
            </div>
          )}
          {included.length > 0 && (
            <div>
              <p className="mt-1 text-xs font-semibold uppercase text-primary">Services included</p>
              <ul className="mt-1 list-disc pl-5">{included.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
        </div>

        )}

        {!docView && <PackageScopeCard service={job.service} packageName={job.packageName} serviceVariant={job.serviceVariant} />}

        {paymentBlock}

        {/* Quotation · Payment · Google Review — all three reachable from the one booking link. */}
        {job.status !== "CANCELLED" && settings?.googleReviewUrl && (
          <a href={settings.googleReviewUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl bg-white p-5 text-sm shadow-sm">
            <span className="flex items-center gap-2 font-semibold"><Star className="size-4 text-amber-500" /> {job.status === "COMPLETED" ? "Rate us on Google" : "Sahara on Google — reviews"}</span>
            <span className="text-primary">{job.status === "COMPLETED" ? "Review →" : "Open →"}</span>
          </a>
        )}

        {!docView && open && (
          <div className="space-y-2 rounded-2xl bg-white p-5 text-sm shadow-sm">
            <p className="font-semibold text-[#0a2540]">Need a change?</p>
            <BookingChangeRequest token={token} />
          </div>
        )}

        <div className="rounded-2xl bg-white p-5 text-sm shadow-sm">
          {!docView && (
            <>
              <p className="font-semibold text-[#0a2540]">Important</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-[#0a2540]/80">
                <li>Please keep water supply and electricity available.</li>
                <li>Arrange a stool / ladder where required.</li>
                <li>Need to change the date? Call or WhatsApp us.</li>
              </ul>
            </>
          )}
          <a href="/terms" className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-primary">Terms &amp; Conditions →</a>
          <div className="mt-3 flex flex-wrap gap-2">
            {support.map((n) => (
              <a key={n} href={`tel:+91${n}`} className="flex min-h-11 items-center gap-1 rounded-full border px-4 py-1.5 text-xs font-semibold">
                <Phone className="size-3" /> {n}
              </a>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-[#0a2540]/60">{COMPANY.name}</p>
        </div>
      </div>
    </div>
  );
}
