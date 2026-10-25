import { parsePackage, lineAmount } from "@/lib/package-calc";
import { COMPANY } from "@/lib/constants";
import { PRICING_MASTER } from "@/lib/pricing-master";
import { conciseHomeExclusions, conciseHomeScope, isAutoScope, tierFromPackage } from "@/lib/service-scope";
import { formatDate } from "@/lib/utils";
import { DocAccordion } from "@/components/public/doc-accordion";

/**
 * Customer quotation / final invoice for one booking — the structure of Sahara's
 * existing customer documents (company header → number/date → Bill To → service
 * table → notes/scope → terms → totals in figures and words → payment details),
 * built from the booking's own frozen price snapshot. Customer prices only —
 * never cost, margin, staff, wages or internal notes.
 */

// Latin digits always ("-u-nu-latn"): never Devanagari "१०" on any device locale. Exact — never rounded.
const inr = (n: number) => `₹${n.toLocaleString("en-IN-u-nu-latn", { maximumFractionDigits: 2 })}`;

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
  /** Billing (owner 2026-10-22): jobValue already includes this GST when gstEnabled. */
  gstEnabled?: boolean;
  gstAmount?: number;
  customerGstin?: string | null;
  /** Reference IDs straight from the database (owner 2026-10-22: one consistent set across every document). */
  customerNumber?: string | null;
  quotationNumber?: string | null;
};

/** Written scope / equipment / terms from the Service Catalog — shown on the quotation only. */
export type CustomerDocCatalog = { name: string; scope: string[]; equipment: string[]; terms: string[] };

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
  /** Data-URL QR for the exact balance due (upi://pay link), built on the server. */
  upiQrDataUrl?: string | null;
  /** Secure online / card payment page for this booking (/booking/pay/{token}). */
  payUrl?: string | null;
};

/** Compact customer terms — the material conditions of BOOKING_TERMS + customer requirements, in 4 lines. */
export const COMPACT_TERMS = [
  "Price covers the scope listed above; any extra work is done only after your approval and charged separately.",
  "Distant locations or urgent / same-day service may carry an extra charge. Festival slots are subject to team availability.",
  "Please arrange water, electricity, a stool / ladder where needed, and access to all areas; keep valuables secured.",
  "Old or permanent stains can't be guaranteed to come off fully; heavy furniture is moved only if agreed.",
];

/** "per seat" x 5 -> "× 5 seats" (unit wording from the price master). */
export function qtyLabel(qty: number, unit: string | null | undefined): string {
  const u = (unit ?? "").replace(/^per\s+/i, "").trim();
  if (!u) return qty > 1 ? `× ${qty}` : "";
  return `× ${qty} ${qty === 1 ? u : /(s|x|ch|sh)$/i.test(u) ? `${u}es` : `${u}s`}`;
}

export function CustomerDocument({ kind, job, company, shareUrl, catalog }: { kind: "QUOTATION" | "INVOICE"; job: CustomerDocJob; company: CustomerDocCompany; shareUrl: string; catalog?: CustomerDocCatalog | null }) {
  const isInvoice = kind === "INVOICE";
  const pkg = parsePackage(job.serviceItems, job.discountAmount);
  const discount = Math.max(0, job.discountAmount ?? 0);
  // GST (optional, B2B): jobValue is the final total, so the taxable base is jobValue minus the GST it carries.
  const gst = job.gstEnabled ? Math.max(0, job.gstAmount ?? 0) : 0;
  const cgst = Math.round((gst / 2) * 100) / 100;
  const sgst = Math.round((gst - cgst) * 100) / 100;
  const baseValue = job.jobValue - gst;
  const packageLabel = [job.packageName, job.serviceVariant && job.serviceVariant !== job.packageName ? job.serviceVariant : null].filter(Boolean).join(" · ");
  // Full-house package -> one concise line ("Full Home Cleaning — Premium"), never the room checklist.
  const unfurnished = /unfurnished/i.test(`${job.packageName ?? ""} ${job.serviceVariant ?? ""}`);
  const tier = pkg.lines.length <= 1 ? tierFromPackage(job.packageName, job.serviceVariant) : null;
  const homeLabel = tier || unfurnished ? `Full Home Cleaning — ${unfurnished ? "Unfurnished" : tier}` : null;
  const property = job.serviceVariant && !/premium|platinum|unfurnished/i.test(job.serviceVariant) ? job.serviceVariant : null;
  // Combo components from the price master's own description ("Empty kitchen · 2 bathrooms · fridge").
  const comboParts = (name: string) =>
    PRICING_MASTER.find((p) => p.group === "COMBO" && (p.name === name || p.variant === name))
      ?.rule?.split(" · ")
      .filter((x) => !/approx\./i.test(x))
      .join(" · ");
  // Itemised package lines when the booking has them; otherwise one line for the booked service.
  const comboTitle = !packageLabel && job.included.length > 0 ? job.included.join(" + ") : "";
  const rows =
    pkg.lines.length > 0
      ? pkg.lines.map((l) => {
          const isHome = !!homeLabel && /premium|platinum/i.test(l.name);
          return l.complimentary
            ? { name: l.name, free: true, detail: `${qtyLabel(l.qty, l.unit)} · free (value ${inr(lineAmount(l))})`, qty: l.qty, rate: l.unitPrice, disc: lineAmount(l), total: 0 }
            : { name: isHome ? homeLabel! : l.name, free: false, detail: isHome ? property ?? "" : qtyLabel(l.qty, l.unit), qty: l.qty, rate: l.unitPrice, disc: 0, total: lineAmount(l) };
        })
      : [
          {
            name: homeLabel ?? (comboTitle ? `Combo Package — ${comboTitle}` : job.serviceLabel),
            detail: homeLabel
              ? [property, job.festivalName ? `${job.festivalName} price` : null].filter(Boolean).join(" · ")
              : comboTitle
                ? job.included.map((c) => [c, comboParts(c)].filter(Boolean).join(": ")).join(" | ")
                : packageLabel,
            free: false,
            qty: 1,
            rate: baseValue + discount,
            disc: discount,
            total: baseValue,
          },
        ];
  const showIncludes = !comboTitle;
  const itemsDiscount = pkg.lines.length > 0 ? discount : 0;
  const subtotal = rows.reduce((s, r) => s + r.total, 0);
  const complimentary = pkg.lines.filter((l) => l.complimentary).reduce((s, l) => s + lineAmount(l), 0);
  const total = job.jobValue > 0 ? job.jobValue : Math.max(0, subtotal - itemsDiscount);
  // Discount shown once, in the totals: gross value, the discount and its percentage, and what the customer saves.
  const hasDisc = rows.some((r) => r.disc > 0);
  const gridCols = hasDisc ? "sm:grid-cols-[3rem_1fr_3rem_5.5rem_5rem_6rem]" : "sm:grid-cols-[3rem_1fr_3rem_5.5rem_6rem]";
  const gross = pkg.lines.length > 0 ? subtotal : baseValue + discount;
  const discountPct = gross > 0 && discount > 0 ? Math.round((discount / gross) * 1000) / 10 : 0;
  const taxable = Math.max(0, total - gst);
  const balance = Math.max(0, total - job.paid);
  // One number everywhere: the stored invoice / quotation number when there is one (the reference strip shows the same).
  const docNo = isInvoice ? job.invoiceNumber || `INV-${job.jobNumber}` : job.quotationNumber || `QO-${job.jobNumber}`;
  const docDate = isInvoice ? (job.completedAt ?? new Date()) : job.createdAt;
  // Concise scope: one line for a full-house package + anything staff actually typed; item
  // bookings need nothing more (each item and quantity is already in the table above).
  const customScope = job.scopeOfWork && !isAutoScope(job.scopeOfWork) ? job.scopeOfWork.trim() : null;
  const scope = [
    ...(homeLabel ? [conciseHomeScope(tier), conciseHomeExclusions(tier)] : []),
    ...(customScope ? customScope.split(/\n+/).map((x) => x.replace(/^[•\-\s]+/, "").trim()).filter(Boolean).slice(0, 4) : []),
  ];
  const hasPayment = !!(company.upiId || company.upiQrUrl || company.payUrl);
  const scopeItems = catalog ? [...catalog.scope, ...(customScope ? customScope.split(/\n+/).map((x) => x.replace(/^[•\-\s]+/, "").trim()).filter(Boolean).slice(0, 4) : [])] : scope;
  const termsItems = catalog && catalog.terms.length > 0 ? catalog.terms : COMPACT_TERMS;

  return (
    <article id="document" lang="en" translate="no" className="notranslate overflow-hidden rounded-2xl border border-[#0a2540]/15 bg-white text-sm text-[#0a2540] shadow-sm print:rounded-none print:border-0 print:text-[10.5px] print:leading-snug print:shadow-none">
      {/* Saved / printed PDF: A4 with slim margins so a normal quotation fits on one page. */}
      <style>{"@media print{@page{size:A4;margin:7mm}html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}#document{break-inside:avoid;page-break-inside:avoid}#document section,#document li,#document footer{break-inside:avoid;page-break-inside:avoid}}"}</style>
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-[#0a2540]/10 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6 print:flex-row print:items-start print:justify-between print:px-4 print:py-2">
        <div className="min-w-0">
          <div className="flex flex-col items-start gap-2 min-[420px]:flex-row min-[420px]:items-center sm:gap-4">
            {company.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className="h-14 w-auto max-w-[170px] shrink-0 object-contain sm:h-[4.5rem] sm:max-w-[220px] print:h-14" />
            )}
            <div className="min-w-0">
              <p className="break-words text-base font-extrabold uppercase leading-tight tracking-wide text-[#0a2540] sm:text-xl">{company.name}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-primary">Deep Cleaning · Pest Control · Interior Painting</p>
            </div>
          </div>
          <p className="mt-1 break-words text-[11px] leading-snug text-[#0a2540]/70">{company.address}</p>
          <p className="break-words text-[11px] leading-snug text-[#0a2540]/70">
            {company.phone} · {company.email}
          </p>
          <p className="text-[11px] text-[#0a2540]/70">GSTIN {COMPANY.gstin}</p>
        </div>
        <div className="shrink-0 sm:text-right print:text-right">
          <p className="inline-block rounded-md bg-primary px-2 py-1 text-[11px] font-extrabold tracking-widest text-white sm:text-xs">{isInvoice ? "INVOICE" : "QUOTATION"}</p>
          <p className="mt-2 text-[10px] uppercase text-[#0a2540]/55">{isInvoice ? "Invoice No." : "Quotation No."}</p>
          <p className="text-xs font-bold">{docNo}</p>
          <p className="mt-1 text-[10px] uppercase text-[#0a2540]/55">Date</p>
          <p className="text-xs font-bold">{formatDate(docDate)}</p>
        </div>
      </header>

      {/* Reference IDs — all read from the database, so a quotation, booking and invoice always agree. */}
      <section className="grid grid-cols-1 gap-x-4 gap-y-1 border-b border-[#0a2540]/10 bg-[#0a2540]/[0.03] px-4 py-2 text-[11px] sm:px-6 print:px-4">
        {[
          // One reference only (owner 2026-10-24): the Booking ID on a quotation, the Job ID on an invoice.
          [isInvoice ? "Job ID" : "Booking ID", job.jobNumber],
        ].map(([label, value]) => (
          <p key={label as string}><span className="block text-[9px] font-semibold uppercase tracking-wide text-[#0a2540]/55">{label}</span><span className="font-bold">{value || "—"}</span></p>
        ))}
      </section>

      {/* Bill to + service schedule */}
      <section className="grid gap-3 border-b border-[#0a2540]/10 p-4 sm:grid-cols-2 sm:p-6 print:grid-cols-2 print:px-4 print:py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Bill To</p>
          <p className="font-bold">{job.customerName}</p>
          <p className="break-words text-xs text-[#0a2540]/75">{job.address || job.area}</p>
          <p className="text-xs text-[#0a2540]/75">Mobile {job.customerMobile}</p>
          {gst > 0 && job.customerGstin && <p className="text-xs text-[#0a2540]/75">GSTIN {job.customerGstin}</p>}
        </div>
        <div className="min-w-0 sm:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Service Schedule</p>
          <p className="text-xs">Booking {job.jobNumber}</p>
          <p className="text-xs">{formatDate(job.scheduledDate)} · {job.scheduledTime}</p>
          {job.festivalName && <p className="text-xs font-semibold text-amber-700">{job.festivalName} festival price</p>}
        </div>
      </section>

      {/* Services table — stacked rows on mobile, columns from sm */}
      <section className="p-4 sm:p-6 print:px-4 print:py-2">
        <div className={`hidden gap-2 border-b border-[#0a2540]/15 pb-2 text-[11px] font-bold uppercase text-[#0a2540]/60 sm:grid ${gridCols}`}>
          <span>Sr. No.</span><span>Service Description</span><span className="text-right">Qty</span><span className="text-right">Rate</span>{hasDisc && <span className="text-right">Disc.</span>}<span className="text-right">Amount</span>
        </div>
        <ol className="divide-y divide-[#0a2540]/10">
          {rows.map((r, i) => (
            <li key={i} className={`py-2.5 sm:grid sm:gap-2 ${gridCols}`}>
              <span className="hidden text-xs text-[#0a2540]/60 sm:block">{i + 1}</span>
              <span className="block min-w-0">
                <span className="block break-words font-semibold">{r.free && <span className="mr-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-emerald-700">COMPLEMENTARY</span>}{r.name}</span>
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
              {hasDisc && <span className="hidden text-right tabular-nums sm:block">{r.disc > 0 ? inr(r.disc) : "—"}</span>}
              <span className="hidden text-right font-semibold tabular-nums sm:block">{inr(r.total)}</span>
            </li>
          ))}
        </ol>

        {/* Totals */}
        <div className="mt-2 space-y-1 border-t border-[#0a2540]/15 pt-3 sm:ml-auto sm:max-w-sm">
          <p className="flex justify-between"><span className="text-[#0a2540]/70">{complimentary > 0 || discount > 0 ? "Base price" : "Subtotal"}</span><span className="tabular-nums">{inr(gross)}</span></p>
          {discount > 0 && (
            <p className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[#0a2540]/70">Discount <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">{discountPct}% OFF</span></span>
              <span className="tabular-nums font-semibold text-emerald-700">− {inr(discount)}</span>
            </p>
          )}
          {complimentary > 0 && <p className="flex justify-between"><span className="text-[#0a2540]/70">Complimentary services (free)</span><span className="tabular-nums text-emerald-700">{inr(complimentary)}</span></p>}
          {gst > 0 && (
            <>
              <p className="flex justify-between"><span className="text-[#0a2540]/70">Taxable value</span><span className="tabular-nums">{inr(taxable)}</span></p>
              <p className="flex justify-between"><span className="text-[#0a2540]/70">CGST 9%</span><span className="tabular-nums">{inr(cgst)}</span></p>
              <p className="flex justify-between"><span className="text-[#0a2540]/70">SGST 9%</span><span className="tabular-nums">{inr(sgst)}</span></p>
            </>
          )}
          {discount > 0 && <p className="rounded-md bg-emerald-50 px-2 py-1 text-center text-xs font-bold text-emerald-700">You save {inr(discount)}{discountPct > 0 ? ` (${discountPct}%)` : ""}</p>}
          <p className="flex items-baseline justify-between rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-2 text-xl font-black"><span className="text-sm font-extrabold uppercase tracking-wide">{isInvoice ? "Total Payable" : "Final Payable"}</span><span className="tabular-nums">{inr(total)}</span></p>
          {/* Advance / balance from recorded payments only — on the quotation too. */}
          <p className="flex justify-between"><span className="text-[#0a2540]/70">{isInvoice ? "Received" : "Advance Paid"}</span><span className="tabular-nums">{inr(job.paid)}</span></p>
          <p className="flex justify-between font-bold"><span>Balance Due</span><span className="tabular-nums">{inr(balance)}</span></p>
          <p className="text-[11px] text-[#0a2540]/60">{rupeesInWords(total)}</p>
        </div>
      </section>

      {/* Quotation only: Scope of Work, Equipment and Terms & Conditions collapse into accordions (open automatically when printed). */}
      {!isInvoice && (scopeItems.length > 0 || termsItems.length > 0) && (
        <section className="space-y-2 border-t-2 border-primary/30 p-4 sm:p-6 print:space-y-2 print:px-4 print:py-2">
          {scopeItems.length > 0 && (
            <DocAccordion title={`Scope of Work${catalog ? ` — ${catalog.name}` : ""}`}>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-snug text-[#0a2540]/80 print:space-y-0.5 print:text-[10px]">{scopeItems.map((x) => <li key={x} className="break-words">{x}</li>)}</ul>
            </DocAccordion>
          )}
          {catalog && catalog.equipment.length > 0 && (
            <DocAccordion title="Equipment Used">
              <p className="text-xs leading-snug text-[#0a2540]/80 print:text-[10px]">{catalog.equipment.filter((e) => !/step[\s-]?ladder/i.test(e)).join(" · ")}</p>
            </DocAccordion>
          )}
          <DocAccordion title="Terms & Conditions">
            <ol className="list-decimal space-y-1 pl-4 text-xs leading-snug text-[#0a2540]/80 print:space-y-0.5 print:text-[10px]">
              {termsItems.map((t) => <li key={t}>{t}</li>)}
            </ol>
            <p className="mt-1.5 text-xs text-[#0a2540]/80 print:text-[10px]">
              <span className="font-semibold">Reschedule, postpone or cancel:</span> use &ldquo;Need a change?&rdquo; on your booking page, or WhatsApp {COMPANY.phones[1] ?? COMPANY.phones[0]}.
            </p>
          </DocAccordion>
        </section>
      )}

      {/* Payment details: UPI, bank transfer, online / card, and the exact-balance QR */}
      {hasPayment && (!isInvoice || balance > 0) && (
        <section className="mx-4 mb-3 grid gap-3 rounded-xl border-2 border-[#0a2540]/15 bg-[#0a2540]/[0.02] p-3 sm:mx-6 sm:grid-cols-[1fr_auto] print:mx-4 print:mb-2 print:p-2">
          <div className="min-w-0 space-y-1 text-xs print:text-[10px]">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Payment Details</p>
            {company.upiId && <p>UPI ID: <span className="font-semibold">{company.upiId}</span> <span className="text-[#0a2540]/55">(PhonePe / GPay / any UPI app)</span></p>}
            {/* Bank account details never appear on public pages (owner rule 2026-10-11); they are on the CRM PDF only. */}
            {company.payUrl && <p className="break-all">Card / online payment: <span className="font-semibold">{company.payUrl}</span></p>}
            <p className="text-[#0a2540]/60">Please share the payment screenshot on WhatsApp after paying.</p>
          </div>
          {company.upiQrDataUrl && balance > 0 ? (
            <div className="shrink-0 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={company.upiQrDataUrl} alt={`UPI QR for ${inr(balance)}`} className="size-32 rounded-md border bg-white object-contain print:size-28" />
              <p className="mt-0.5 text-[10px] font-semibold text-[#0a2540]/70">Scan to pay {inr(balance)}</p>
            </div>
          ) : (
            company.upiQrUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.upiQrUrl} alt="Payment QR code" className="size-28 shrink-0 rounded-md border bg-white object-contain print:size-24" />
            )
          )}
        </section>
      )}

    </article>
  );
}
