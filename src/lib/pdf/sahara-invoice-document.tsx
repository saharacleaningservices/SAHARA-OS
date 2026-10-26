import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COMPANY } from "../constants";

import { INVOICE_LEGAL_TERMS } from "../invoice-terms";
import { BrandFooter, FONT, FOOTER_CATEGORIES, PaymentBlock, SignatoryBox, SOCIAL_LINKS as BRAND_SOCIAL, hasPaymentBlock, inr, num as fmtNum, type PaymentBlockProps } from "./brand-kit";

// Sahara TAX INVOICE (owner 2026-10-25) — a myBillBook-style single A4 page, invoices ONLY (quotations keep SaharaBillDocument).
// Centered brand header → TAX INVOICE badge → Bill To (clean: no property / test-booking tags) → table
// (No., SERVICES, Qty, Rate, [Sq. Ft / Area], Total) → summary (discount lives here only) → bulleted scope → legal-only terms →
// brand footer with service categories, contact icons and clickable social links. No payment QR, no static "20% advance" box.
// Layout model: BOX MODEL — fixed A4 frame, fixed column widths, so every invoice prints identically.

const BLUE = "#1E40AF";
const INK = "#0f172a";
const MUTED = "#475569";
const LINE = "#cbd5e1";
const SOFT = "#eff4ff";

export const INVOICE_FOOTER_SERVICES = FOOTER_CATEGORIES;

export const SOCIAL_LINKS = BRAND_SOCIAL;

export type InvoiceRow = { name: string; detail?: string; qty: number; rate: number; total: number; area?: string };
export type InvoiceDocumentProps = {
  /** "TAX INVOICE" only when GST is charged; otherwise "INVOICE" (owner 2026-10-25). Defaults from totals.gstAmount / gstPercent. */
  title?: string;
  number: string;
  date: string;
  jobId?: string | null;
  /** Company seal (data URL of public/stamp.png) printed inside the signatory box. */
  stampDataUrl?: string | null;
  company: { name: string; tagline?: string; phones: string[]; email: string; website: string; address: string; gstin: string };
  logoDataUrl?: string | null;
  billTo: { name: string; address?: string | null; mobile?: string | null; email?: string | null; gstin?: string | null };
  rows: InvoiceRow[];
  /** true when at least one row carries a Sq. Ft / Area value (commercial work) — adds the column. */
  showArea: boolean;
  totals: { subtotal: number; discount: number; gstPercent?: number; gstAmount?: number; total: number; received: number; balance: number };
  amountInWords: string;
  scope: string[];
  terms?: string[];
  /** Bank details + UPI QR for the balance due (null once fully paid). */
  payment?: PaymentBlockProps | null;
};

/** GST charged (> 0) → "TAX INVOICE"; non-GST / 0% → plain "INVOICE" (never "Tax Invoice" without tax). */
export function invoiceTitle(t: { gstPercent?: number | null; gstAmount?: number | null }): "TAX INVOICE" | "INVOICE" {
  return (t.gstAmount ?? 0) > 0 || (t.gstPercent ?? 0) > 0 ? "TAX INVOICE" : "INVOICE";
}

export const INVOICE_TAGLINE = "Your Trusted Home Service Partner";

const rs = inr; // "₹7,000", Latin digits always
const num = fmtNum;

/** Scale factor so the whole invoice stays on ONE A4 page. */
export function invoiceFit(p: Pick<InvoiceDocumentProps, "rows" | "scope" | "terms"> & { payment?: boolean }): number {
  const wrap = (t: string, per: number) => Math.max(1, Math.ceil(t.length / per));
  const load = p.rows.reduce((n, r) => n + (r.detail ? 2.4 : 1.6), 0) + p.scope.reduce((n, t) => n + wrap(t, 95), 0) * 0.9 + (p.terms ?? INVOICE_LEGAL_TERMS).reduce((n, t) => n + wrap(t, 105), 0) * 0.85 + (p.payment ? 12 : 0) + 15; // + stamp box & icon footer
  if (load <= 24) return 1;
  if (load <= 30) return 0.92;
  if (load <= 38) return 0.82;
  if (load <= 48) return 0.72;
  if (load <= 60) return 0.64;
  return 0.56;
}

function styles(k: number) {
  const z = (n: number) => Math.round(n * k * 10) / 10;
  return StyleSheet.create({
    page: { padding: z(20), fontSize: z(9), color: INK, fontFamily: FONT.regular },
    frame: { borderWidth: 1.2, borderColor: BLUE, flexGrow: 1 },
    head: { flexDirection: "row", alignItems: "center", paddingHorizontal: z(14), paddingTop: z(10), paddingBottom: z(8), borderBottomWidth: 1, borderBottomColor: LINE },
    headLogo: { width: z(120), justifyContent: "center", alignItems: "flex-start" },
    logo: { width: z(116), height: z(46), objectFit: "contain" },
    headMid: { flexGrow: 1, flexShrink: 1, alignItems: "center", paddingHorizontal: z(6) },
    headRight: { width: z(120), alignItems: "flex-end" },
    name: { fontFamily: FONT.bold, fontSize: z(17), letterSpacing: z(0.8), color: BLUE, textAlign: "center" },
    tag: { fontFamily: FONT.italic, fontSize: z(8.5), color: MUTED, textAlign: "center", marginTop: z(0.5) },
    gst: { fontFamily: FONT.bold, fontSize: z(8.5), marginTop: z(2), textAlign: "center" },
    mob: { fontSize: z(8.5), color: MUTED, marginTop: z(1), textAlign: "center" },
    badge: { backgroundColor: BLUE, color: "#ffffff", fontFamily: FONT.bold, fontSize: z(10), letterSpacing: z(1.2), paddingVertical: z(3), paddingHorizontal: z(10), borderRadius: 3 },
    copy: { marginTop: z(3), fontSize: z(6), color: MUTED, letterSpacing: 0.5 },
    meta: { flexDirection: "row", paddingHorizontal: z(16), paddingVertical: z(7), borderBottomWidth: 1, borderBottomColor: LINE, backgroundColor: SOFT },
    metaCell: { marginRight: z(28) },
    mL: { fontFamily: FONT.bold, fontSize: z(8), color: BLUE, marginBottom: z(1.5) },
    mV: { fontSize: z(9) },
    bill: { paddingHorizontal: z(16), paddingVertical: z(8) },
    billL: { fontFamily: FONT.bold, fontSize: z(8), color: BLUE, marginBottom: z(2) },
    billN: { fontFamily: FONT.bold, fontSize: z(10.5), marginBottom: z(1.5) },
    billT: { fontSize: z(8.5), color: MUTED, marginBottom: z(1.5) },
    // Boxed grid (owner 2026-10-26): the table sits in one bordered box with a thin vertical rule between columns.
    tbl: { marginHorizontal: z(16), borderWidth: 0.8, borderColor: BLUE },
    vl: { borderRightWidth: 0.6, borderRightColor: LINE, paddingHorizontal: z(4) },
    th: { flexDirection: "row", backgroundColor: BLUE, paddingVertical: z(5) },
    thT: { color: "#ffffff", fontFamily: FONT.bold, fontSize: z(8.5), paddingHorizontal: z(4) },
    tr: { flexDirection: "row", paddingVertical: z(5), borderTopWidth: 0.6, borderTopColor: LINE },
    cell: { fontSize: z(9), paddingHorizontal: z(4) },
    scopeBox: { marginHorizontal: z(16), marginTop: z(8), borderWidth: 0.8, borderColor: BLUE, borderRadius: 4, paddingHorizontal: z(8), paddingBottom: z(4) },
    detail: { fontSize: z(7.5), color: MUTED, marginTop: z(1) },
    sumWrap: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: z(16), paddingTop: z(10) },
    words: { width: "52%", paddingRight: z(10) },
    secT: { fontFamily: FONT.bold, fontSize: z(9), color: BLUE, marginBottom: z(3), marginTop: z(8) },
    para: { fontSize: z(8), color: MUTED, lineHeight: 1.35 },
    sum: { width: "44%" },
    kv: { flexDirection: "row", justifyContent: "space-between", marginBottom: z(2.5) },
    kL: { fontSize: z(9), color: MUTED },
    kR: { fontSize: z(9) },
    totalBox: { flexDirection: "row", justifyContent: "space-between", backgroundColor: SOFT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BLUE, paddingVertical: z(5), paddingHorizontal: z(4), marginVertical: z(3) },
    totalT: { fontFamily: FONT.bold, fontSize: z(11), color: BLUE },
    bullets: { paddingHorizontal: z(16) },
    bullet: { flexDirection: "row", marginBottom: z(2) },
    dot: { width: z(9), fontSize: z(8.5), color: BLUE },
    signRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: z(16), marginTop: z(8), marginBottom: z(6) },
    footer: { marginTop: "auto" },
  });
}

export function SaharaInvoiceDocument(p: InvoiceDocumentProps) {
  const terms = p.terms ?? INVOICE_LEGAL_TERMS;
  const title = p.title ?? invoiceTitle(p.totals);
  const k = invoiceFit({ rows: p.rows, scope: p.scope, terms, payment: !!(p.payment && hasPaymentBlock(p.payment)) });
  const s = styles(k);
  // Column widths (percent of the row). Sq. Ft / Area appears only for commercial invoices.
  const w = p.showArea ? { no: "9%", name: "37%", qty: "9%", rate: "14%", area: "14%", total: "17%" } : { no: "9%", name: "49%", qty: "10%", rate: "15%", area: "0%", total: "17%" };
  const phones = p.company.phones.join("  |  ");
  return (
    <Document title={`${title === "TAX INVOICE" ? "Tax Invoice" : "Invoice"} ${p.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.frame}>
          {/* Header (owner 2026-10-25): logo strictly LEFT; name, tagline and GSTIN centred; badge right. */}
          <View style={s.head}>
            <View style={s.headLogo}>{p.logoDataUrl ? <Image src={p.logoDataUrl} style={s.logo} /> : null}</View>
            <View style={s.headMid}>
              <Text style={s.name}>{p.company.name.toUpperCase()}</Text>
              <Text style={s.tag}>{p.company.tagline ?? INVOICE_TAGLINE}</Text>
              <Text style={s.gst}>GSTIN: {p.company.gstin}  |  SAC: {COMPANY.sac}</Text>
              <Text style={s.mob}>{phones}</Text>
            </View>
            <View style={s.headRight}>
              <Text style={s.badge}>{title}</Text>
              <Text style={s.copy}>ORIGINAL FOR RECIPIENT</Text>
            </View>
          </View>

          <View style={s.meta}>
            <View style={s.metaCell}><Text style={s.mL}>Invoice No.</Text><Text style={s.mV}>{p.number}</Text></View>
            <View style={s.metaCell}><Text style={s.mL}>Invoice Date</Text><Text style={s.mV}>{p.date}</Text></View>
            {p.jobId ? <View style={s.metaCell}><Text style={s.mL}>Job ID</Text><Text style={s.mV}>{p.jobId}</Text></View> : null}
          </View>

          <View style={s.bill}>
            <Text style={s.billL}>BILL TO</Text>
            <Text style={s.billN}>{p.billTo.name}</Text>
            {p.billTo.address && p.billTo.address.trim() !== "—" ? <Text style={s.billT}>{p.billTo.address}</Text> : null}
            {p.billTo.mobile ? <Text style={s.billT}>Mobile: {p.billTo.mobile}</Text> : null}
            {p.billTo.email ? <Text style={s.billT}>Email: {p.billTo.email}</Text> : null}
            {p.billTo.gstin ? <Text style={s.billT}>GSTIN: {p.billTo.gstin}</Text> : null}
          </View>

          <View style={s.tbl}>
            <View style={s.th}>
              <Text style={[s.thT, s.vl, { width: w.no, color: "#ffffff", borderRightColor: "#ffffff55" }]}>Sr. No.</Text>
              <Text style={[s.thT, s.vl, { width: w.name, color: "#ffffff", borderRightColor: "#ffffff55" }]}>SERVICES</Text>
              <Text style={[s.thT, s.vl, { width: w.qty, textAlign: "right", color: "#ffffff", borderRightColor: "#ffffff55" }]}>Qty</Text>
              <Text style={[s.thT, s.vl, { width: w.rate, textAlign: "right", color: "#ffffff", borderRightColor: "#ffffff55" }]}>Rate (₹)</Text>
              {p.showArea ? <Text style={[s.thT, s.vl, { width: w.area, textAlign: "right", color: "#ffffff", borderRightColor: "#ffffff55" }]}>Sq. Ft / Area</Text> : null}
              <Text style={[s.thT, { width: w.total, textAlign: "right" }]}>Total (₹)</Text>
            </View>
            {p.rows.map((r, i) => (
              <View key={i} style={s.tr} wrap={false}>
                <Text style={[s.cell, s.vl, { width: w.no }]}>{i + 1}</Text>
                <View style={[s.vl, { width: w.name }]}>
                  <Text style={{ fontSize: s.cell.fontSize }}>{r.name}</Text>
                  {r.detail ? <Text style={s.detail}>{r.detail}</Text> : null}
                </View>
                <Text style={[s.cell, s.vl, { width: w.qty, textAlign: "right" }]}>{r.qty}</Text>
                <Text style={[s.cell, s.vl, { width: w.rate, textAlign: "right" }]}>{num(r.rate)}</Text>
                {p.showArea ? <Text style={[s.cell, s.vl, { width: w.area, textAlign: "right" }]}>{r.area ?? "—"}</Text> : null}
                <Text style={[s.cell, { width: w.total, textAlign: "right", fontFamily: FONT.bold }]}>{num(r.total)}</Text>
              </View>
            ))}
          </View>

          <View style={s.sumWrap}>
            <View style={s.words}>
              <Text style={[s.secT, { marginTop: 0 }]}>Total Amount (in words)</Text>
              <Text style={s.para}>{p.amountInWords}</Text>
            </View>
            <View style={s.sum}>
              <View style={s.kv}><Text style={s.kL}>Subtotal</Text><Text style={s.kR}>{rs(p.totals.subtotal)}</Text></View>
              {p.totals.discount > 0 ? <View style={s.kv}><Text style={s.kL}>Discount</Text><Text style={s.kR}>- {rs(p.totals.discount)}</Text></View> : null}
              {p.totals.gstAmount ? <View style={s.kv}><Text style={s.kL}>GST ({p.totals.gstPercent}%) included</Text><Text style={s.kR}>{rs(p.totals.gstAmount)}</Text></View> : null}
              <View style={s.totalBox}><Text style={s.totalT}>Total</Text><Text style={s.totalT}>{rs(p.totals.total)}</Text></View>
              {/* Advance Paid appears only when a payment is actually recorded. */}
              {p.totals.received > 0 ? <View style={s.kv}><Text style={s.kL}>Advance / Amount Paid</Text><Text style={s.kR}>{rs(p.totals.received)}</Text></View> : null}
              <View style={s.kv}><Text style={[s.kR, { fontFamily: FONT.bold }]}>Balance Due</Text><Text style={[s.kR, { fontFamily: FONT.bold }]}>{rs(p.totals.balance)}</Text></View>
            </View>
          </View>

          {p.scope.length > 0 ? (
            <View style={s.scopeBox}>
              <Text style={s.secT}>Service Scope Notes</Text>
              {p.scope.map((t, i) => (
                <View key={i} style={s.bullet} wrap={false}><Text style={s.dot}>•</Text><Text style={[s.para, { flex: 1 }]}>{t}</Text></View>
              ))}
            </View>
          ) : null}

          <View style={s.bullets}>
            <Text style={s.secT}>Terms &amp; Conditions</Text>
            {terms.map((t, i) => (
              <View key={i} style={s.bullet} wrap={false}><Text style={s.dot}>{i + 1}.</Text><Text style={[s.para, { flex: 1 }]}>{t}</Text></View>
            ))}
          </View>

          {p.payment && hasPaymentBlock(p.payment) ? (
            <View style={{ paddingHorizontal: 16 * k, marginTop: 8 * k }}>
              <PaymentBlock {...p.payment} k={k} />
            </View>
          ) : null}

          <View style={s.signRow}>
            <SignatoryBox company={p.company.name} stampDataUrl={p.stampDataUrl} k={k} />
          </View>

          <View style={s.footer}>
            <BrandFooter phones={p.company.phones} email={p.company.email} website={p.company.website} address={p.company.address} k={k} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
