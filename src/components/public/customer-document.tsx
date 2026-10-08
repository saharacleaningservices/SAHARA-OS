import { parsePackage, lineAmount } from "@/lib/package-calc";
import { COMPANY } from "@/lib/constants";
import { BOOKING_TERMS } from "@/lib/pricing-master";
import { formatDate } from "@/lib/utils";
import { DocumentActions } from "@/components/public/document-actions";

/**
 * Customer quotation / final invoice for one booking — the structure of Sahara's
 * existing customer documents (company header → number/date → Bill To → service
 * table → notes/scope → terms → totals in figures and words → payment details),
 * built from the booking's own frozen price snapshot. Customer prices only —
 * never cost, margin, staff, wages or internal notes.
 */

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; // exact — never rounded

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" ");
}
/** Indian numbering in words: 7800 → "Seven Thousand Eight Hundred Rupees". */
export function rupeesInWords(amount: number): string {
  const total = Math.round(Math.max(0, amount) * 100); // paise — exact, no whole-rupee rounding
  let n = Math.floor(total / 100);
  const paise = total % 100;
  const paiseWords = paise ? ` and ${below1000(paise)} Paise` : "";
  if (n === 0) return paise ? `${below1000(paise)} Paise` : "Zero Rupees";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  return `${parts.join(" ")} Rupees${paiseWords}`;
}

export type CustomerDocJob = {
  jobNumber: string;
  customerName: string;
  customerMobile: string;
  address: string | null;
  area: string | null;
  serviceLabel: string;
  packageName: string | null;
  serviceVariant: string | null;
  included: string[];
  serviceItems: string | null;
  discountAmount: number | null;
  jobValue: number;
  scopeOfWork: string | null;
  scheduledDate: Date;
  scheduledTime: string;
  createdAt: Date;
  completedAt: Date | null;
  festivalName: string | null;
  paid: number;
  invoiceNumber: string | null;
};

export type CustomerDocCompany = {
  name: string;
  phone: string;
  email: string;
  address: string;
  website: string | null;
  logoUrl: string | null;
  upiId: string | null;
  upiQrUrl: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
};

export function CustomerDocument({ kind, job, company, shareUrl }: { kind: "QUOTATION" | "INVOICE"; job: CustomerDocJob; company: CustomerDocCompany; shareUrl: string }) {
  const isInvoice = kind === "INVOICE";
  const pkg = parsePackage(job.serviceItems, job.discountAmount);
  const discount = Math.max(0, job.discountAmount ?? 0);
  const packageLabel = [job.packageName, job.serviceVariant && job.serviceVariant !== job.packageName ? job.serviceVariant : null].filter(Boolean).join(" · ");
  // Itemised package lines when the booking has them; otherwise one line for the booked
  // service — titled by the combo package(s) when the booking is a combo with no tier.
  const comboTitle = !packageLabel && job.included.length > 0 ? job.included.join(" · ") : "";
  const rows =
    pkg.lines.length > 0
      ? pkg.lines.map((l) =>
          l.complimentary
            ? { name: `${l.name} (Complimentary)`, detail: `Free · value ${inr(lineAmount(l))}`, qty: l.qty, rate: l.unitPrice, disc: lineAmount(l), total: 0 }
            : { name: l.name, detail: l.unit ?? "", qty: l.qty, rate: l.unitPrice, disc: 0, total: lineAmount(l) },
        )
      : [{ name: comboTitle || job.serviceLabel, detail: comboTitle ? `${job.serviceLabel} · package` : packageLabel, qty: 1, rate: job.jobValue + discount, disc: discount, total: job.jobValue }];
  const showIncludes = !comboTitle;
  const itemsDiscount = pkg.lines.length > 0 ? discount : 0;
  const subtotal = rows.reduce((s, r) => s + r.total, 0);
  const complimentary = pkg.lines.filter((l) => l.complimentary).reduce((s, l) => s + lineAmount(l), 0);
  const total = job.jobValue > 0 ? job.jobValue : Math.max(0, subtotal - itemsDiscount);
  const balance = Math.max(0, total - job.paid);
  const docNo = isInvoice ? job.invoiceNumber || `INV-${job.jobNumber}` : `QO-${job.jobNumber}`;
  const docDate = isInvoice ? (job.completedAt ?? new Date()) : job.createdAt;
  const scope = (job.scopeOfWork ?? "").split(/\n+/).map((s) => s.replace(/^[•\-\s]+/, "").trim()).filter(Boolean);
  const hasPayment = !!(company.upiId || company.upiQrUrl || company.bankAccountNumber);

  return (
    <article id="document" className="overflow-hidden rounded-2xl bg-white text-sm text-[#0a2540] shadow-sm print:rounded-none print:shadow-none">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-[#0a2540]/10 p-4 sm:p-6">
        <div className="min-w-0">
          {company.logoUrl ? (
             
            <img src={company.logoUrl} alt={company.name} className="h-9 w-auto max-w-[150px] object-contain sm:h-11" />
          ) : (
            <p className="text-base font-extrabold uppercase tracking-wide text-primary">{company.name}</p>
          )}
          <p className="mt-1 text-[11px] font-semibold text-[#0a2540]/70">Deep Cleaning · Pest Control · Interior Painting</p>
          <p className="mt-1 break-words text-[11px] leading-snug text-[#0a2540]/70">{company.address}</p>
          <p className="break-words text-[11px] leading-snug text-[#0a2540]/70">
            {company.phone} · {company.email}
          </p>
          <p className="text-[11px] text-[#0a2540]/70">GSTIN {COMPANY.gstin}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="rounded-md bg-primary px-2 py-1 text-[11px] font-extrabold tracking-widest text-white sm:text-xs">{isInvoice ? "INVOICE" : "QUOTATION"}</p>
          <p className="mt-2 text-[10px] uppercase text-[#0a2540]/55">{isInvoice ? "Invoice No." : "Quotation No."}</p>
          <p className="text-xs font-bold">{docNo}</p>
          <p className="mt-1 text-[10px] uppercase text-[#0a2540]/55">Date</p>
          <p className="text-xs font-bold">{formatDate(docDate)}</p>
        </div>
      </header>

      {/* Bill to + service schedule */}
      <section className="grid gap-3 border-b border-[#0a2540]/10 p-4 sm:grid-cols-2 sm:p-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Bill To</p>
          <p className="font-bold">{job.customerName}</p>
          <p className="break-words text-xs text-[#0a2540]/75">{job.address || job.area}</p>
          <p className="text-xs text-[#0a2540]/75">Mobile {job.customerMobile}</p>
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Service Schedule</p>
          <p className="text-xs">Booking {job.jobNumber}</p>
          <p className="text-xs">{formatDate(job.scheduledDate)} · {job.scheduledTime}</p>
          {job.festivalName && <p className="text-xs font-semibold text-amber-700">{job.festivalName} festival price</p>}
        </div>
      </section>

      {/* Services table — stacked rows on mobile, columns from sm */}
      <section className="p-4 sm:p-6">
        <div className="hidden grid-cols-[2rem_1fr_3rem_5.5rem_5rem_6rem] gap-2 border-b border-[#0a2540]/15 pb-2 text-[11px] font-bold uppercase text-[#0a2540]/60 sm:grid">
          <span>No</span><span>Services</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Disc.</span><span className="text-right">Total</span>
        </div>
        <ol className="divide-y divide-[#0a2540]/10">
          {rows.map((r, i) => (
            <li key={i} className="py-2.5 sm:grid sm:grid-cols-[2rem_1fr_3rem_5.5rem_5rem_6rem] sm:gap-2">
              <span className="hidden text-xs text-[#0a2540]/60 sm:block">{i + 1}</span>
              <span className="block min-w-0">
                <span className="block break-words font-semibold">{r.name}</span>
                {r.detail && <span className="block break-words text-xs text-[#0a2540]/65">{r.detail}</span>}
                {i === 0 && showIncludes && job.included.length > 0 &&<span className="block break-words text-xs text-[#0a2540]/65">Includes: {job.included.join(", ")}</span>}
              </span>
              {/* mobile: qty × rate = total on one line */}
              <span className="mt-1 flex justify-between text-xs tabular-nums text-[#0a2540]/75 sm:hidden">
                <span>{r.qty} × {inr(r.rate)}{r.disc > 0 ? ` − ${inr(r.disc)}` : ""}</span>
                <span className="text-sm font-bold text-[#0a2540]">{inr(r.total)}</span>
              </span>
              <span className="hidden text-right tabular-nums sm:block">{r.qty}</span>
              <span className="hidden text-right tabular-nums sm:block">{inr(r.rate)}</span>
              <span className="hidden text-right tabular-nums sm:block">{r.disc > 0 ? inr(r.disc) : "—"}</span>
              <span className="hidden text-right font-semibold tabular-nums sm:block">{inr(r.total)}</span>
            </li>
          ))}
        </ol>

        {/* Totals */}
        <div className="mt-2 space-y-1 border-t border-[#0a2540]/15 pt-3 sm:ml-auto sm:max-w-xs">
          <p className="flex justify-between"><span className="text-[#0a2540]/70">{complimentary > 0 || itemsDiscount > 0 ? "Actual Value" : "Subtotal"}</span><span className="tabular-nums">{inr(subtotal)}</span></p>
          {itemsDiscount > 0 && <p className="flex justify-between"><span className="text-[#0a2540]/70">Discount</span><span className="tabular-nums">− {inr(itemsDiscount)}</span></p>}
          {complimentary > 0 && <p className="flex justify-between"><span className="text-[#0a2540]/70">Complimentary (free)</span><span className="tabular-nums">{inr(complimentary)}</span></p>}
          <p className="flex justify-between rounded-lg bg-primary/10 px-2 py-1.5 text-base font-extrabold"><span>{isInvoice ? "Total Amount" : "Final Payable"}</span><span className="tabular-nums">{inr(total)}</span></p>
          {isInvoice && (
            <>
              <p className="flex justify-between"><span className="text-[#0a2540]/70">Received</span><span className="tabular-nums">{inr(job.paid)}</span></p>
              <p className="flex justify-between font-bold"><span>Balance</span><span className="tabular-nums">{inr(balance)}</span></p>
            </>
          )}
          <p className="text-[11px] text-[#0a2540]/60">{rupeesInWords(total)}</p>
        </div>
      </section>

      {/* Scope / notes */}
      {(scope.length > 0 || packageLabel) && (
        <section className="border-t border-[#0a2540]/10 p-4 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Scope of Work</p>
          {scope.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-relaxed text-[#0a2540]/80">{scope.map((s) => <li key={s} className="break-words">{s}</li>)}</ul>
          ) : (
            <p className="mt-1 text-xs text-[#0a2540]/80">{job.serviceLabel} — {packageLabel}. Full scope is listed on your booking page.</p>
          )}
        </section>
      )}

      {/* Terms */}
      <section className="border-t border-[#0a2540]/10 p-4 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Terms &amp; Conditions</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs leading-relaxed text-[#0a2540]/80">
          {BOOKING_TERMS.map((t) => <li key={t}>{t}</li>)}
          <li>Customer to arrange water supply, electricity and a stool/ladder where required.</li>
        </ol>
      </section>

      {/* Payment details */}
      {hasPayment && (!isInvoice || balance > 0) && (
        <section className="flex flex-wrap items-start gap-4 border-t border-[#0a2540]/10 p-4 sm:p-6">
          <div className="min-w-0 flex-1 text-xs">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Payment Details</p>
            {company.upiId && <p className="mt-1">UPI ID: <span className="font-semibold">{company.upiId}</span></p>}
            {company.bankAccountNumber && (
              <p className="mt-1 break-words">
                {company.bankAccountName ?? company.name} · A/C {company.bankAccountNumber}
                {company.bankIfsc ? ` · IFSC ${company.bankIfsc}` : ""}
                {company.bankName ? ` · ${company.bankName}` : ""}
              </p>
            )}
            <p className="mt-1 text-[#0a2540]/60">Please share the payment screenshot on WhatsApp after paying.</p>
          </div>
          {company.upiQrUrl && (
             
            <img src={company.upiQrUrl} alt="Payment QR code" className="size-28 shrink-0 rounded-md border bg-white object-contain" />
          )}
        </section>
      )}

      <footer className="flex flex-wrap items-end justify-between gap-3 border-t border-[#0a2540]/10 p-4 text-xs sm:p-6">
        <p className="text-[#0a2540]/60">Questions? Call / WhatsApp {COMPANY.phones.join(" / ")}</p>
        <p className="text-right font-semibold">For {company.name}</p>
      </footer>
      <DocumentActions shareUrl={shareUrl} title={`${isInvoice ? "Invoice" : "Quotation"} ${docNo} — ${company.name}`} />
    </article>
  );
}
