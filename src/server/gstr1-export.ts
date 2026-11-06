// Multi-year GSTR-1 Excel export (owner 2026-11-06, Task 5). Read-only.
// Sources: CRM invoices that charged GST, plus MyBillBook sales invoices synced into the CRM. A MyBillBook invoice
// linked to a CRM job that already has a CRM GST invoice is skipped, so nothing is counted twice. When a MyBillBook
// GST-book invoice has no line detail, taxable / tax are derived from the total at 18% and flagged.
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { fyLabel, fyRange } from "@/lib/fy";
import { parseStoredDetail } from "@/lib/mybillbook-detail";
import { buildGstr1Sheets, splitInclusive, type GstLine } from "@/lib/gstr1";

const r2 = (n: number) => Math.round(n * 100) / 100;
const names = (json: string) => {
  try {
    return (JSON.parse(json) as { name?: string }[]).map((l) => l.name).filter(Boolean).join(" + ");
  } catch {
    return "";
  }
};

export async function gstr1Lines(fromFy: string, toFy: string): Promise<GstLine[]> {
  const from = fyRange(fromFy).from;
  const to = fyRange(toFy).to;
  const [crm, mbb] = await Promise.all([
    db.invoice.findMany({
      where: { createdAt: { gte: from, lt: to }, status: { not: "CANCELLED" }, gstAmount: { gt: 0 } },
      orderBy: { createdAt: "asc" },
      include: { job: { select: { customerGstin: true, service: true } } },
    }),
    db.mybillbookInvoice.findMany({
      where: { docType: "SALES_INVOICE", invoiceDate: { gte: from, lt: to } },
      orderBy: { invoiceDate: "asc" },
      include: { customer: { select: { name: true, gstin: true } } },
    }),
  ]);
  const crmJobIds = new Set(crm.map((i) => i.jobId).filter(Boolean) as string[]);
  const lines: GstLine[] = crm.map((i) => ({
    date: i.createdAt,
    no: i.invoiceNumber,
    party: i.customerName,
    gstin: i.job?.customerGstin ?? "",
    service: i.job?.service ?? names(i.lineItems),
    taxable: r2(i.totalAmount - i.gstAmount),
    gst: r2(i.gstAmount),
    rate: i.gstPercent || 18,
    total: r2(i.totalAmount),
    source: "CRM",
  }));
  for (const m of mbb) {
    if (m.jobId && crmJobIds.has(m.jobId)) continue;
    const d = parseStoredDetail(m.detailJson);
    const gstin = d?.partyGstin ?? m.gstin ?? m.customer?.gstin ?? "";
    const service = m.serviceName ?? d?.lines.map((l) => l.name).join(" + ") ?? "";
    if (d && d.gstAmount > 0) {
      const rate = d.lines.find((l) => l.gstPercent > 0)?.gstPercent ?? 18;
      lines.push({ date: m.invoiceDate, no: m.invoiceNo, party: m.customer?.name ?? d.partyName ?? m.contactName, gstin, service, taxable: r2(m.amount - d.gstAmount), gst: r2(d.gstAmount), rate, total: r2(m.amount), source: m.dataset === "GST" ? "MyBillBook GST" : "MyBillBook" });
    } else if (m.dataset === "GST") {
      const s = splitInclusive(m.amount, 18);
      lines.push({ date: m.invoiceDate, no: m.invoiceNo, party: m.customer?.name ?? m.contactName, gstin, service, taxable: s.taxable, gst: s.gst, rate: 18, total: r2(m.amount), source: "MyBillBook GST", derived: true });
    }
    // Non-GST (retail) book without tax lines: not a GSTR-1 supply line.
  }
  return lines;
}

export async function buildGstr1Workbook(fromFy: string, toFy: string): Promise<{ buffer: Buffer; filename: string; rows: number }> {
  const lines = await gstr1Lines(fromFy, toFy);
  const s = buildGstr1Sheets(lines);
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, string | number>[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No records in this range" }]), name);
  add("Summary by Year", s.summary);
  add("b2b", s.b2b);
  add("b2cs", s.b2cs);
  add("hsn", s.hsn);
  add("docs", s.docs);
  add("Notes", [
    { Note: `Sahara Cleaning Services — GSTR-1 working file, ${fyLabel(fromFy)} to ${fyLabel(toFy)}. Generated ${new Date().toISOString().slice(0, 10)} from Sahara OS.` },
    { Note: "Place of supply 27-Maharashtra (intra-state): tax shown as equal CGST + SGST, IGST 0. Filter each sheet by Return Period (MMYYYY) for one month's return." },
    { Note: "SAC: 998533 cleaning / housekeeping, 998531 pest control, 995471 painting (mapped from the service). Confirm codes with the CA." },
    { Note: `${s.derivedCount} MyBillBook GST-book invoice(s) had no line detail: taxable and tax derived from the invoice total at 18% (marked in b2b Source).` },
    { Note: "Credit notes, amendments and nil-rated / exempt supplies are not included. Reconcile with the returns already filed before use." },
  ]);
  const filename = `Sahara-GSTR1-${fromFy === toFy ? fyLabel(fromFy) : `${fyLabel(fromFy)}-to-${fyLabel(toFy)}`}`.replace(/\s/g, "-") + ".xlsx";
  return { buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer, filename, rows: lines.length };
}
