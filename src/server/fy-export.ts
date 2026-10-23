// Financial-year Excel exports (owner 2026-10-23): Sales, GST and Quotations for one FY (1 Apr – 31 Mar, IST).
// Read-only; Super Admin + Accounts only (route gate). Sales = CRM invoices (not cancelled) + the past MyBillBook invoices imported into
// the CRM. A MyBillBook invoice that belongs to a CRM job is flagged "CRM job" — it is shown, not hidden, so nothing is dropped.
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { fyLabel, fyRange } from "@/lib/fy";
import { parseStoredDetail } from "@/lib/mybillbook-detail";

export type FyReport = "sales" | "gst" | "quotations";
const r2 = (n: number) => Math.round(n * 100) / 100;
const IST_MS = 5.5 * 3600 * 1000;
const day = (x: Date) => new Date(x.getTime() + IST_MS).toISOString().slice(0, 10);
const month = (x: Date) => day(x).slice(0, 7);

type Line = { date: Date; no: string; party: string; mobile: string; gstin: string; service: string; taxable: number; gst: number; gstPercent: number; total: number; paid: number; status: string; source: string; crmJob: string };

const names = (json: string) => {
  try {
    return (JSON.parse(json) as { name?: string }[]).map((l) => l.name).filter(Boolean).join(" + ");
  } catch {
    return "";
  }
};

async function salesLines(fy: string): Promise<Line[]> {
  const { from, to } = fyRange(fy);
  const [crm, mbb] = await Promise.all([
    db.invoice.findMany({ where: { createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" } }, orderBy: { createdAt: "asc" } }),
    db.mybillbookInvoice.findMany({ where: { invoiceDate: { gte: from, lt: to } }, orderBy: { invoiceDate: "asc" }, include: { customer: { select: { name: true, mobile: true } } } }),
  ]);
  const lines: Line[] = crm.map((i) => ({
    date: i.createdAt,
    no: i.invoiceNumber,
    party: i.customerName,
    mobile: i.customerMobile ?? "",
    gstin: "",
    service: names(i.lineItems),
    taxable: r2(i.totalAmount - i.gstAmount),
    gst: r2(i.gstAmount),
    gstPercent: i.gstPercent,
    total: r2(i.totalAmount),
    paid: i.status === "PAID" ? r2(i.totalAmount) : 0,
    status: i.status,
    source: "CRM",
    crmJob: i.jobId ? "Yes" : "",
  }));
  for (const m of mbb) {
    const d = parseStoredDetail(m.detailJson);
    lines.push({
      date: m.invoiceDate,
      no: m.invoiceNo,
      party: m.customer?.name ?? d?.partyName ?? m.contactName,
      mobile: m.customer?.mobile ?? m.partyMobile ?? "",
      gstin: d?.partyGstin ?? "",
      service: m.serviceName ?? "",
      taxable: r2(m.amount - (d?.gstAmount ?? 0)),
      gst: r2(d?.gstAmount ?? 0),
      gstPercent: d?.lines.find((l) => l.gstPercent > 0)?.gstPercent ?? 0,
      total: r2(m.amount),
      paid: r2(Math.max(0, m.amount - m.remaining)),
      status: m.status,
      source: "MyBillBook",
      crmJob: m.jobId ? "Yes" : "",
    });
  }
  return lines.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function monthly<T>(rows: T[], key: (r: T) => Date, cols: (rs: T[]) => Record<string, number>) {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(month(key(r)), [...(m.get(month(key(r))) ?? []), r]);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, rs]) => ({ Month: k, ...cols(rs) }));
}

const sumOf = <T,>(rs: T[], f: (r: T) => number) => r2(rs.reduce((s, r) => s + f(r), 0));

export async function buildFyWorkbook(fy: string, report: FyReport): Promise<{ buffer: Buffer; filename: string }> {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, string | number>[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No records in this financial year" }]), name.slice(0, 31));

  if (report === "quotations") {
    const { from, to } = fyRange(fy);
    const qs = await db.quotation.findMany({ where: { createdAt: { gte: from, lt: to } }, orderBy: { createdAt: "asc" }, include: { lead: { select: { name: true, mobile: true } }, invoice: { select: { invoiceNumber: true } } } });
    add(
      "Quotations",
      qs.map((q) => ({ Date: day(q.createdAt), "Quotation No": q.quoteNumber, Customer: q.lead.name, Mobile: q.lead.mobile, Services: names(q.services), "Sub Total": r2(q.subTotal), Discount: r2(q.discount), "GST %": q.gstPercent, GST: r2(q.gstAmount), Total: r2(q.totalAmount), Status: q.status, "Valid Till": q.validTill ? day(q.validTill) : "", "Invoice No": q.invoice?.invoiceNumber ?? "" })),
    );
    const by = new Map<string, { n: number; v: number }>();
    for (const q of qs) {
      const cur = by.get(q.status) ?? { n: 0, v: 0 };
      by.set(q.status, { n: cur.n + 1, v: cur.v + q.totalAmount });
    }
    add("Summary", [...by.entries()].map(([Status, x]) => ({ Status, Count: x.n, Value: r2(x.v) })).concat([{ Status: "ALL", Count: qs.length, Value: sumOf(qs, (q) => q.totalAmount) }]));
  } else {
    const lines = await salesLines(fy);
    if (report === "sales") {
      add("Sales", lines.map((l) => ({ Date: day(l.date), "Invoice No": l.no, Customer: l.party, Mobile: l.mobile, Service: l.service, Taxable: l.taxable, GST: l.gst, Total: l.total, Paid: l.paid, Balance: r2(l.total - l.paid), Status: l.status, Source: l.source, "CRM job": l.crmJob })));
      add("Monthly", monthly(lines, (l) => l.date, (rs) => ({ Invoices: rs.length, Taxable: sumOf(rs, (l) => l.taxable), GST: sumOf(rs, (l) => l.gst), Total: sumOf(rs, (l) => l.total), Collected: sumOf(rs, (l) => l.paid) })));
    } else {
      const g = lines.filter((l) => l.gst > 0 || l.gstin);
      add("GST Register", g.map((l) => ({ Date: day(l.date), "Invoice No": l.no, Party: l.party, GSTIN: l.gstin, Taxable: l.taxable, "GST %": l.gstPercent, CGST: r2(l.gst / 2), SGST: r2(l.gst / 2), "Total GST": l.gst, "Invoice Total": l.total, Source: l.source })));
      add("Monthly GST", monthly(g, (l) => l.date, (rs) => ({ Invoices: rs.length, Taxable: sumOf(rs, (l) => l.taxable), CGST: sumOf(rs, (l) => l.gst / 2), SGST: sumOf(rs, (l) => l.gst / 2), "Total GST": sumOf(rs, (l) => l.gst) })));
      add("Note", [{ Note: "CGST/SGST shown as an equal split (intra-state, Maharashtra). Invoices without GST are not listed. Verify against the filed returns before use." }]);
    }
  }
  const name = report === "gst" ? "GST" : report === "sales" ? "Sales" : "Quotations";
  return { buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer, filename: `Sahara-${name}-${fyLabel(fy).replace(/\s/g, "-")}.xlsx` };
}
