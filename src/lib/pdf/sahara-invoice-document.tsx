import { Document, Font, Image, Link, Page, Path, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import { INVOICE_LEGAL_TERMS } from "../invoice-terms";

Font.registerHyphenationCallback((word) => [word]);

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

export const INVOICE_FOOTER_SERVICES = ["HOME DEEP CLEANING", "COMMERCIAL CLEANING", "INTERIOR PAINTING", "PEST CONTROL", "HOUSEKEEPING & AMC"];

export const SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/saharacleaningservices.pune/",
  facebook: "https://www.facebook.com/saharacleaningservices",
  youtube: "https://www.youtube.com/channel/UCHfIf88WCd5HE0L1CU5iBXA",
  google: "https://g.page/r/CYJ9szEiGaN4EBE/review",
} as const;

export type InvoiceRow = { name: string; detail?: string; qty: number; rate: number; total: number; area?: string };
export type InvoiceDocumentProps = {
  number: string;
  date: string;
  jobId?: string | null;
  company: { name: string; phones: string[]; email: string; website: string; address: string; gstin: string };
  logoDataUrl?: string | null;
  billTo: { name: string; address?: string | null; mobile?: string | null; email?: string | null; gstin?: string | null };
  rows: InvoiceRow[];
  /** true when at least one row carries a Sq. Ft / Area value (commercial work) — adds the column. */
  showArea: boolean;
  totals: { subtotal: number; discount: number; gstPercent?: number; gstAmount?: number; total: number; received: number; balance: number };
  amountInWords: string;
  scope: string[];
  terms?: string[];
};

const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** Scale factor so the whole invoice stays on ONE A4 page. */
export function invoiceFit(p: Pick<InvoiceDocumentProps, "rows" | "scope" | "terms">): number {
  const wrap = (t: string, per: number) => Math.max(1, Math.ceil(t.length / per));
  const load = p.rows.reduce((n, r) => n + (r.detail ? 2.4 : 1.6), 0) + p.scope.reduce((n, t) => n + wrap(t, 95), 0) * 0.9 + (p.terms ?? INVOICE_LEGAL_TERMS).reduce((n, t) => n + wrap(t, 105), 0) * 0.85;
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
    page: { padding: z(20), fontSize: z(9), color: INK, fontFamily: "Helvetica" },
    frame: { borderWidth: 1.2, borderColor: BLUE, flexGrow: 1 },
    head: { alignItems: "center", paddingTop: z(12), paddingBottom: z(8), borderBottomWidth: 1, borderBottomColor: LINE },
    logo: { width: z(120), height: z(40), objectFit: "contain", marginBottom: z(3) },
    name: { fontFamily: "Helvetica-Bold", fontSize: z(19), letterSpacing: z(1.2), color: BLUE, textAlign: "center" },
    gst: { fontFamily: "Helvetica-Bold", fontSize: z(9), marginTop: z(3), textAlign: "center" },
    mob: { fontSize: z(9), color: MUTED, marginTop: z(1.5), textAlign: "center" },
    badge: { marginTop: z(6), backgroundColor: BLUE, color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: z(10.5), letterSpacing: z(1.5), paddingVertical: z(3), paddingHorizontal: z(16), borderRadius: 3 },
    copy: { marginTop: z(3), fontSize: z(6.5), color: MUTED, letterSpacing: 0.6 },
    meta: { flexDirection: "row", paddingHorizontal: z(16), paddingVertical: z(7), borderBottomWidth: 1, borderBottomColor: LINE, backgroundColor: SOFT },
    metaCell: { marginRight: z(28) },
    mL: { fontFamily: "Helvetica-Bold", fontSize: z(8), color: BLUE, marginBottom: z(1.5) },
    mV: { fontSize: z(9) },
    bill: { paddingHorizontal: z(16), paddingVertical: z(8) },
    billL: { fontFamily: "Helvetica-Bold", fontSize: z(8), color: BLUE, marginBottom: z(2) },
    billN: { fontFamily: "Helvetica-Bold", fontSize: z(10.5), marginBottom: z(1.5) },
    billT: { fontSize: z(8.5), color: MUTED, marginBottom: z(1.5) },
    th: { flexDirection: "row", backgroundColor: BLUE, paddingVertical: z(5), paddingHorizontal: z(16) },
    thT: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: z(8.5) },
    tr: { flexDirection: "row", paddingVertical: z(5), paddingHorizontal: z(16), borderBottomWidth: 0.6, borderBottomColor: LINE },
    cell: { fontSize: z(9) },
    detail: { fontSize: z(7.5), color: MUTED, marginTop: z(1) },
    sumWrap: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: z(16), paddingTop: z(10) },
    words: { width: "52%", paddingRight: z(10) },
    secT: { fontFamily: "Helvetica-Bold", fontSize: z(9), color: BLUE, marginBottom: z(3), marginTop: z(8) },
    para: { fontSize: z(8), color: MUTED, lineHeight: 1.35 },
    sum: { width: "44%" },
    kv: { flexDirection: "row", justifyContent: "space-between", marginBottom: z(2.5) },
    kL: { fontSize: z(9), color: MUTED },
    kR: { fontSize: z(9) },
    totalBox: { flexDirection: "row", justifyContent: "space-between", backgroundColor: SOFT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: BLUE, paddingVertical: z(5), paddingHorizontal: z(4), marginVertical: z(3) },
    totalT: { fontFamily: "Helvetica-Bold", fontSize: z(11), color: BLUE },
    bullets: { paddingHorizontal: z(16) },
    bullet: { flexDirection: "row", marginBottom: z(2) },
    dot: { width: z(9), fontSize: z(8.5), color: BLUE },
    sign: { alignSelf: "flex-end", marginRight: z(16), marginTop: z(8), width: z(150), borderTopWidth: 0.8, borderTopColor: INK, paddingTop: z(3), alignItems: "center" },
    signT: { fontFamily: "Helvetica-Bold", fontSize: z(8) },
    footer: { marginTop: "auto" },
    cats: { backgroundColor: BLUE, paddingVertical: z(6), paddingHorizontal: z(8) },
    catsT: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: z(7.4), textAlign: "center", letterSpacing: 0.1 },
    contactRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", backgroundColor: SOFT, paddingVertical: z(5), paddingHorizontal: z(8) },
    cItem: { flexDirection: "row", alignItems: "center", marginHorizontal: z(7), marginVertical: z(1) },
    cTxt: { fontSize: z(8), marginLeft: z(3) },
    socialRow: { flexDirection: "row", justifyContent: "center", paddingVertical: z(4), backgroundColor: SOFT },
    soc: { fontFamily: "Helvetica-Bold", fontSize: z(8), color: BLUE, marginHorizontal: z(8), textDecoration: "none" },
  });
}

// Small vector icons (react-pdf cannot render icon fonts). 24×24 paths.
const ICONS = {
  phone: "M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z",
  mail: "M3 5h18v14H3V5zm9 8L4.5 7v-.5h15V7L12 13z",
  globe: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c1.6 1.7 2.6 4 2.9 7H9.1c.3-3 1.3-5.3 2.9-7zM4.3 13h3.3c.1 1.9.5 3.6 1.2 5.1A8 8 0 014.3 13zm3.3-2H4.3a8 8 0 014.5-5.1C8.1 7.4 7.7 9.1 7.6 11zm4.4 9c-1.6-1.7-2.6-4-2.9-7h5.8c-.3 3-1.3 5.3-2.9 7zm3.2-1.9c.7-1.5 1.1-3.2 1.2-5.1h3.3a8 8 0 01-4.5 5.1zM16.4 11c-.1-1.9-.5-3.6-1.2-5.1A8 8 0 0119.7 11h-3.3z",
  pin: "M12 2a7 7 0 00-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z",
};
const Icon = ({ d, size = 9 }: { d: string; size?: number }) => (
  <Svg viewBox="0 0 24 24" width={size} height={size}>
    <Path d={d} fill={BLUE} />
  </Svg>
);

export function SaharaInvoiceDocument(p: InvoiceDocumentProps) {
  const terms = p.terms ?? INVOICE_LEGAL_TERMS;
  const s = styles(invoiceFit({ rows: p.rows, scope: p.scope, terms }));
  // Column widths (percent of the row). Sq. Ft / Area appears only for commercial invoices.
  const w = p.showArea ? { no: "7%", name: "39%", qty: "9%", rate: "14%", area: "14%", total: "17%" } : { no: "8%", name: "50%", qty: "10%", rate: "15%", area: "0%", total: "17%" };
  const phones = p.company.phones.join("  |  ");
  return (
    <Document title={`Tax Invoice ${p.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.frame}>
          <View style={s.head}>
            {p.logoDataUrl ? <Image src={p.logoDataUrl} style={s.logo} /> : null}
            <Text style={s.name}>{p.company.name.toUpperCase()}</Text>
            <Text style={s.gst}>GSTIN: {p.company.gstin}</Text>
            <Text style={s.mob}>Mobile: {phones}</Text>
            <Text style={s.badge}>TAX INVOICE</Text>
            <Text style={s.copy}>ORIGINAL FOR RECIPIENT</Text>
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

          <View style={s.th}>
            <Text style={[s.thT, { width: w.no }]}>No.</Text>
            <Text style={[s.thT, { width: w.name }]}>SERVICES</Text>
            <Text style={[s.thT, { width: w.qty, textAlign: "right" }]}>Qty</Text>
            <Text style={[s.thT, { width: w.rate, textAlign: "right" }]}>Rate (Rs.)</Text>
            {p.showArea ? <Text style={[s.thT, { width: w.area, textAlign: "right" }]}>Sq. Ft / Area</Text> : null}
            <Text style={[s.thT, { width: w.total, textAlign: "right" }]}>Total (Rs.)</Text>
          </View>
          {p.rows.map((r, i) => (
            <View key={i} style={s.tr} wrap={false}>
              <Text style={[s.cell, { width: w.no }]}>{i + 1}</Text>
              <View style={{ width: w.name, paddingRight: 6 }}>
                <Text style={s.cell}>{r.name}</Text>
                {r.detail ? <Text style={s.detail}>{r.detail}</Text> : null}
              </View>
              <Text style={[s.cell, { width: w.qty, textAlign: "right" }]}>{r.qty}</Text>
              <Text style={[s.cell, { width: w.rate, textAlign: "right" }]}>{num(r.rate)}</Text>
              {p.showArea ? <Text style={[s.cell, { width: w.area, textAlign: "right" }]}>{r.area ?? "—"}</Text> : null}
              <Text style={[s.cell, { width: w.total, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{num(r.total)}</Text>
            </View>
          ))}

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
              <View style={s.kv}><Text style={[s.kR, { fontFamily: "Helvetica-Bold" }]}>Balance Due</Text><Text style={[s.kR, { fontFamily: "Helvetica-Bold" }]}>{rs(p.totals.balance)}</Text></View>
            </View>
          </View>

          {p.scope.length > 0 ? (
            <View style={s.bullets}>
              <Text style={s.secT}>Scope of Work</Text>
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

          <View style={s.sign} wrap={false}><Text style={s.signT}>Authorised Signatory</Text><Text style={[s.para, { fontSize: 7 }]}>For {p.company.name.toUpperCase()}</Text></View>

          <View style={s.footer} wrap={false}>
            <View style={s.cats}><Text style={s.catsT}>{INVOICE_FOOTER_SERVICES.join("  •  ")}</Text></View>
            <View style={s.contactRow}>
              <View style={s.cItem}><Icon d={ICONS.phone} /><Text style={s.cTxt}>{phones}</Text></View>
              <View style={s.cItem}><Icon d={ICONS.mail} /><Text style={s.cTxt}>{p.company.email}</Text></View>
              <View style={s.cItem}><Icon d={ICONS.globe} /><Text style={s.cTxt}>{p.company.website}</Text></View>
              <View style={s.cItem}><Icon d={ICONS.pin} /><Text style={s.cTxt}>{p.company.address}</Text></View>
            </View>
            <View style={s.socialRow}>
              <Link src={SOCIAL_LINKS.instagram} style={s.soc}>Instagram</Link>
              <Link src={SOCIAL_LINKS.facebook} style={s.soc}>Facebook</Link>
              <Link src={SOCIAL_LINKS.youtube} style={s.soc}>YouTube</Link>
              <Link src={SOCIAL_LINKS.google} style={s.soc}>Google Review</Link>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
