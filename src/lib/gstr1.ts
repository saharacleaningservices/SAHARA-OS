// GSTR-1 workbook builder (owner 2026-11-06, Task 5) — pure: takes invoice lines, returns sheet rows.
// Layout follows the GST offline-tool sheets (b2b, b2cs, hsn, docs) so a CA can copy-paste per return period,
// plus a per-year summary. Intra-state (Maharashtra, POS 27): tax is split equally into CGST + SGST, no IGST.
import { sacFor } from "@/lib/sac";
import { fyOf } from "@/lib/fy";

export type GstLine = {
  date: Date;
  no: string;
  party: string;
  gstin: string;
  service: string;
  taxable: number;
  gst: number;
  /** GST rate in %, e.g. 18 */
  rate: number;
  total: number;
  source: string;
  /** true when the tax split was derived from the invoice total (no line detail on file). */
  derived?: boolean;
};

export const POS = "27-Maharashtra";
const IST_MS = 5.5 * 3600 * 1000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ist = (d: Date) => new Date(d.getTime() + IST_MS);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "06-Nov-2026" — the date format of the GST offline tool. */
export const gstDate = (d: Date) => {
  const x = ist(d);
  return `${String(x.getUTCDate()).padStart(2, "0")}-${MONTHS[x.getUTCMonth()]}-${x.getUTCFullYear()}`;
};
/** Return period "MMYYYY" (e.g. 112026). */
export const returnPeriod = (d: Date) => {
  const x = ist(d);
  return `${String(x.getUTCMonth() + 1).padStart(2, "0")}${x.getUTCFullYear()}`;
};
const periodSort = (p: string) => `${p.slice(2)}${p.slice(0, 2)}`;

/** Taxable + GST from a GST-inclusive total at `rate` % (used when no line detail exists). */
export function splitInclusive(total: number, rate = 18) {
  const taxable = r2(total / (1 + rate / 100));
  return { taxable, gst: r2(total - taxable) };
}

export const isB2b = (l: Pick<GstLine, "gstin">) => /^[0-3][0-9][A-Z0-9]{13}$/.test((l.gstin ?? "").trim().toUpperCase());

export function buildGstr1Sheets(lines: GstLine[]) {
  const taxed = lines.filter((l) => l.gst > 0.004 || isB2b(l)).sort((a, b) => a.date.getTime() - b.date.getTime());
  const half = (n: number) => r2(n / 2);

  const b2b = taxed.filter(isB2b).map((l) => ({
    "GSTIN/UIN of Recipient": l.gstin.trim().toUpperCase(),
    "Receiver Name": l.party,
    "Invoice Number": l.no,
    "Invoice date": gstDate(l.date),
    "Invoice Value": r2(l.total),
    "Place Of Supply": POS,
    "Reverse Charge": "N",
    "Applicable % of Tax Rate": "",
    "Invoice Type": "Regular B2B",
    "E-Commerce GSTIN": "",
    Rate: l.rate,
    "Taxable Value": r2(l.taxable),
    "Cess Amount": 0,
    CGST: half(l.gst),
    SGST: half(l.gst),
    SAC: sacFor(l.service),
    "Return Period": returnPeriod(l.date),
    FY: fyOf(l.date),
    Source: l.source + (l.derived ? " (tax derived from total)" : ""),
  }));

  // B2C (small): aggregated per return period × rate.
  const b2csMap = new Map<string, { period: string; rate: number; taxable: number; gst: number }>();
  for (const l of taxed.filter((x) => !isB2b(x))) {
    const k = `${returnPeriod(l.date)}|${l.rate}`;
    const cur = b2csMap.get(k) ?? { period: returnPeriod(l.date), rate: l.rate, taxable: 0, gst: 0 };
    cur.taxable += l.taxable;
    cur.gst += l.gst;
    b2csMap.set(k, cur);
  }
  const b2cs = [...b2csMap.values()]
    .sort((a, b) => periodSort(a.period).localeCompare(periodSort(b.period)) || a.rate - b.rate)
    .map((x) => ({ "Return Period": x.period, Type: "OE", "Place Of Supply": POS, "Applicable % of Tax Rate": "", Rate: x.rate, "Taxable Value": r2(x.taxable), "Cess Amount": 0, "E-Commerce GSTIN": "", CGST: half(x.gst), SGST: half(x.gst) }));

  // HSN / SAC summary per return period × SAC.
  const hsnMap = new Map<string, { period: string; sac: string; n: number; value: number; taxable: number; gst: number }>();
  for (const l of taxed) {
    const sac = sacFor(l.service);
    const k = `${returnPeriod(l.date)}|${sac}`;
    const cur = hsnMap.get(k) ?? { period: returnPeriod(l.date), sac, n: 0, value: 0, taxable: 0, gst: 0 };
    cur.n += 1;
    cur.value += l.total;
    cur.taxable += l.taxable;
    cur.gst += l.gst;
    hsnMap.set(k, cur);
  }
  const SAC_DESC: Record<string, string> = { "998533": "Cleaning services", "998531": "Disinfecting and exterminating (pest control) services", "995471": "Painting services" };
  const hsn = [...hsnMap.values()]
    .sort((a, b) => periodSort(a.period).localeCompare(periodSort(b.period)) || a.sac.localeCompare(b.sac))
    .map((x) => ({ "Return Period": x.period, HSN: x.sac, Description: SAC_DESC[x.sac] ?? "Services", UQC: "NA-NOT APPLICABLE", "Total Quantity": x.n, "Total Value": r2(x.value), "Taxable Value": r2(x.taxable), "Integrated Tax Amount": 0, "Central Tax Amount": half(x.gst), "State/UT Tax Amount": half(x.gst), "Cess Amount": 0 }));

  // Documents issued per return period (first / last number as sorted, count).
  const docMap = new Map<string, string[]>();
  for (const l of taxed) docMap.set(returnPeriod(l.date), [...(docMap.get(returnPeriod(l.date)) ?? []), l.no]);
  const docs = [...docMap.entries()]
    .sort(([a], [b]) => periodSort(a).localeCompare(periodSort(b)))
    .map(([period, nos]) => {
      const sorted = [...nos].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
      return { "Return Period": period, "Nature of Document": "Invoices for outward supply", "Sr. No. From": sorted[0], "Sr. No. To": sorted[sorted.length - 1], "Total Number": nos.length, Cancelled: 0 };
    });

  // Per financial year summary.
  const fyMap = new Map<string, { b2bN: number; b2bTaxable: number; b2bGst: number; b2cTaxable: number; b2cGst: number }>();
  for (const l of taxed) {
    const fy = fyOf(l.date);
    const cur = fyMap.get(fy) ?? { b2bN: 0, b2bTaxable: 0, b2bGst: 0, b2cTaxable: 0, b2cGst: 0 };
    if (isB2b(l)) {
      cur.b2bN += 1;
      cur.b2bTaxable += l.taxable;
      cur.b2bGst += l.gst;
    } else {
      cur.b2cTaxable += l.taxable;
      cur.b2cGst += l.gst;
    }
    fyMap.set(fy, cur);
  }
  const summary = [...fyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fy, x]) => ({
      "Financial Year": fy,
      "B2B Invoices": x.b2bN,
      "B2B Taxable": r2(x.b2bTaxable),
      "B2B CGST": half(x.b2bGst),
      "B2B SGST": half(x.b2bGst),
      "B2C Taxable": r2(x.b2cTaxable),
      "B2C CGST": half(x.b2cGst),
      "B2C SGST": half(x.b2cGst),
      "Total Taxable": r2(x.b2bTaxable + x.b2cTaxable),
      "Total GST": r2(x.b2bGst + x.b2cGst),
    }));

  return { b2b, b2cs, hsn, docs, summary, derivedCount: taxed.filter((l) => l.derived).length };
}
