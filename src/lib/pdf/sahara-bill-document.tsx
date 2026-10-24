import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Whole words only (no "SER-VICES" hyphenation), as on Sahara’s existing documents.
Font.registerHyphenationCallback((word) => [word]);

// One professional layout for Sahara quotations and invoices (MyBillBook-style
// structure: framed page, brand header, number/date strip, Bill To, service
// table with Qty / Rate / Disc. / Total, subtotal band, Notes + Terms on the
// left, totals + amount in words + signatory on the right, payment QR).
// Rendered on demand — nothing is stored on the server.

export const SLOGAN = "Your Trusted Home Service Partner";
export const CORE_SERVICES = ["Home Deep Cleaning", "Commercial Cleaning", "Interior Painting", "Pest Control", "Housekeeping & AMC"];

const GOLD = "#c9a961";
const NAVY = "#24325a";
const MUTED = "#5b6478";
const BEIGE = "#faf3e6";
const ROYAL = "#1E40AF"; // footer strip (owner 2026-10-24)

// k < 1 only for single-page quotations (see fitFactor); invoices render at k = 1, exactly as before.
function makeStyles(k: number) {
  const z = (n: number) => Math.round(n * k * 10) / 10;
  return StyleSheet.create({
  page: { padding: z(22), fontSize: z(9), color: NAVY, fontFamily: "Helvetica" },
  frame: { borderWidth: 1.5, borderColor: GOLD, flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: z(18), paddingTop: z(12), paddingBottom: z(8), borderBottomWidth: 1, borderBottomColor: GOLD },
  headRight: { flexGrow: 1, flexShrink: 1, alignItems: "flex-end", paddingLeft: z(10) },
  docTitle: { fontFamily: "Helvetica-Bold", fontSize: z(14), color: NAVY, letterSpacing: 1, marginTop: z(4) },
  slogan: { fontFamily: "Times-Italic", fontSize: z(10.5), color: NAVY, marginTop: z(2), marginBottom: z(3), textAlign: "center" },
  phones: { fontFamily: "Helvetica-Bold", fontSize: z(9.5), color: NAVY, marginTop: z(2), textAlign: "right" },
  contactC: { fontSize: z(8), color: MUTED, marginBottom: z(1), textAlign: "center" },
  titleBar: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: z(5), borderBottomWidth: 1, borderBottomColor: GOLD, backgroundColor: BEIGE },
  titleC: { fontSize: z(12), fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1 },
  // Logo in its own fixed box (scaled to fit, never overflowing), company text in the remaining width — they can't overlap.
  logoCol: { width: z(150), height: z(52), marginBottom: z(2), justifyContent: "center", alignItems: "flex-start" },
  logo: { width: z(146), height: z(50), objectFit: "contain" },
  companyCol: { flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  companyName: { fontFamily: "Times-Bold", fontSize: z(16), letterSpacing: z(0.3), lineHeight: 1.15, color: NAVY, textAlign: "right" },
  tagline: { fontSize: z(9), color: MUTED, marginTop: z(2), marginBottom: z(6) },
  contact: { fontSize: z(8.5), color: NAVY, marginBottom: z(2) },
  titleCol: { width: z(110), flexShrink: 0, alignItems: "flex-end" },
  title: { fontSize: z(13), fontFamily: "Helvetica-Bold", color: NAVY },
  copyBox: { marginTop: z(4), borderWidth: 0.8, borderColor: MUTED, paddingHorizontal: z(5), paddingVertical: z(2), fontSize: z(6.5), color: MUTED },
  metaStrip: { flexDirection: "row", paddingHorizontal: z(18), paddingVertical: z(9), borderBottomWidth: 1, borderBottomColor: GOLD },
  metaCell: { marginRight: z(32) },
  metaLabel: { fontFamily: "Helvetica-Bold", fontSize: z(8.5), marginBottom: z(2) },
  metaValue: { fontSize: z(8.5), color: MUTED },
  billTo: { paddingHorizontal: z(18), paddingVertical: z(10) },
  billToLabel: { fontFamily: "Helvetica-Bold", fontSize: z(9.5), marginBottom: z(2) },
  billName: { fontSize: z(10.5), marginBottom: z(2) },
  billLine: { fontSize: z(8.5), color: MUTED, marginBottom: z(2) },
  tHead: { flexDirection: "row", backgroundColor: BEIGE, paddingVertical: z(6), paddingHorizontal: z(18) },
  tRow: { flexDirection: "row", paddingVertical: z(6), paddingHorizontal: z(18) },
  tSub: { flexDirection: "row", backgroundColor: BEIGE, paddingVertical: z(6), paddingHorizontal: z(18), fontFamily: "Helvetica-Bold" },
  cNo: { width: "7%" },
  cName: { width: "41%", paddingRight: 6 },
  cQty: { width: "10%", textAlign: "right" },
  cRate: { width: "14%", textAlign: "right" },
  cDisc: { width: "13%", textAlign: "right" },
  cTotal: { width: "15%", textAlign: "right" },
  headTxt: { fontSize: z(8.5), fontFamily: "Helvetica-Bold" },
  rowName: { fontSize: z(9) },
  rowDetail: { fontSize: z(7.5), color: MUTED, marginTop: z(1) },
  pct: { fontSize: z(7), color: MUTED },
  bottom: { flexDirection: "row", paddingHorizontal: z(18), paddingTop: z(12), paddingBottom: z(10) },
  left: { width: "52%", paddingRight: 14 },
  right: { width: "48%" },
  secTitle: { fontFamily: "Helvetica-Bold", fontSize: z(9), marginBottom: z(3), marginTop: z(6) },
  para: { fontSize: z(7.5), color: MUTED, lineHeight: 1.4, marginBottom: z(1.5) },
  totalBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: GOLD, paddingVertical: z(6), flexDirection: "row", justifyContent: "space-between", marginBottom: z(6) },
  totalLbl: { fontFamily: "Helvetica-Bold", fontSize: z(11) },
  totalVal: { fontFamily: "Helvetica-Bold", fontSize: z(11) },
  kv: { flexDirection: "row", justifyContent: "space-between", marginBottom: z(2) },
  kvL: { fontSize: z(8.5), color: MUTED },
  kvR: { fontSize: z(8.5) },
  kvBold: { fontSize: z(8.5), fontFamily: "Helvetica-Bold" },
  words: { fontSize: z(8.5), color: MUTED, marginBottom: z(8) },
  splitBox: { borderWidth: 1, borderColor: GOLD, borderRadius: 4, padding: z(4), marginTop: z(4), marginBottom: z(6) },
  footer: { marginTop: "auto" },
  signRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: z(18), paddingBottom: z(6) },
  servicesBar: { backgroundColor: ROYAL, paddingVertical: z(6), paddingHorizontal: z(10) },
  footSlogan: { color: "#ffffff", fontFamily: "Times-Italic", fontSize: z(10.5), textAlign: "center", marginBottom: z(2) },
  footContact: { color: "#ffffff", fontSize: z(7.5), textAlign: "center", marginTop: z(1) },
  servicesTxt: { color: "#ffffff", fontSize: z(8), textAlign: "center", letterSpacing: 0.3 },
  signBox: { width: z(170), borderWidth: 1, borderColor: GOLD, borderRadius: 8, height: z(46), justifyContent: "flex-end", alignItems: "center", paddingBottom: z(5) },
  signLbl: { fontFamily: "Helvetica-Bold", fontSize: z(8.5) },
  signName: { fontSize: z(8), color: MUTED },
  payRow: { flexDirection: "row", alignItems: "center", marginTop: z(6) },
  // Fixed 78 pt (2.75 cm) whatever the page scale: the code itself stays above 2.5 cm and keeps its white quiet zone.
  qr: { width: 78, height: 78, borderWidth: 1, borderColor: GOLD, borderRadius: 6, padding: 1.5, marginRight: z(10), backgroundColor: "#ffffff" },
  bankGrid: { flexDirection: "row", marginBottom: z(1) },
  bankK: { width: 64, fontSize: z(8), fontFamily: "Helvetica-Bold" },
  bankV: { fontSize: z(8), color: MUTED, flexShrink: 1 },
});
}

type Styles = ReturnType<typeof makeStyles>;
const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; // exact — never rounded
const num = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export type BillRow = { name: string; detail?: string; qty: number; rate: number; disc: number; total: number };
export type BillDocumentProps = {
  kind: "QUOTATION" | "INVOICE";
  title: string; // "QUOTATION" | "BILL OF SUPPLY" | "TAX INVOICE"
  copyLabel?: string; // "ORIGINAL FOR RECIPIENT"
  number: string;
  date: string;
  extraMeta?: { label: string; value: string }[];
  company: { name: string; tagline?: string; slogan?: string; phone: string; phones?: string[]; email: string; address: string; website: string; gstin?: string | null };
  logoDataUrl?: string | null;
  billTo: { name: string; address?: string | null; mobile?: string | null; email?: string | null; details?: { label: string; value: string }[] };
  /** 20% advance / 80% balance (owner rule 2026-10-18), from paymentSplit() in lib/booking-payment. */
  paymentSplit?: { advance: number; balance: number; percent: number; balancePercent: number } | null;
  /** No longer printed (the footer carries the signature and the services bar instead); kept so older callers still type-check. */
  bookQrDataUrl?: string | null;
  bookUrl?: string | null;
  /** Core services shown in the bottom bar. */
  services?: string[];
  rows: BillRow[];
  subtotalRow: { qty: number; disc: number; total: number };
  totals: { subtotal: number; discount: number; complimentary?: number; gstPercent?: number; gstAmount?: number; total: number; received?: number; balance?: number };
  amountInWords: string;
  notes: string[];
  kindlyNote: string[];
  terms: string;
  bank?: { name?: string | null; ifsc?: string | null; account?: string | null; bankName?: string | null } | null;
  upiId?: string | null;
  qrDataUrl?: string | null;
  /** Quotations: fit everything on ONE A4 page (fonts / spacing scale down with the amount of text). */
  singlePage?: boolean;
  /** When set, the kindly-note lines print under this heading (before Terms) as bullets, e.g. "Not Included (Exclusions)". */
  exclusionsTitle?: string;
};

/** Rough line count of the longest column + table rows → scale factor for a single A4 page. Verified by tests/quotation-pdf.test.mts. */
export function fitFactor(p: Pick<BillDocumentProps, "rows" | "notes" | "kindlyNote" | "terms"> & Partial<Pick<BillDocumentProps, "paymentSplit" | "bookQrDataUrl" | "billTo" | "bank" | "qrDataUrl" | "upiId" | "totals">>): number {
  const wrap = (t: string, per: number) => Math.max(1, Math.ceil(t.length / per)) * 1;
  const left = p.notes.reduce((n, t) => n + wrap(t, 66), 0) + p.kindlyNote.reduce((n, t) => n + wrap(t, 66), 0) + p.terms.split("\n").reduce((n, t) => n + wrap(t, 66), 0);
  const table = p.rows.reduce((n, r) => n + (r.detail ? 2.6 : 1.7), 0);
  // Payment-terms box, booking QR footer and the extra Bill To lines (email, property / service) take fixed space.
  const extra =
    (p.paymentSplit ? 4 : 0) + 4 + (p.billTo?.email ? 1 : 0) + ((p.billTo?.details ?? []).length ? 1 : 0) +
    // Right column on invoices: bank details, payment QR, received / balance and GST lines.
    (p.bank?.account || p.bank?.ifsc ? 5 : 0) + (p.qrDataUrl || p.upiId ? 6 : 0) + (p.totals?.received !== undefined ? 2 : 0) + (p.totals?.gstAmount ? 1 : 0) + (p.totals?.discount ? 2 : 0);
  const load = left + table * 1.4 + extra;
  if (load <= 40) return 1;
  if (load <= 50) return 0.92;
  if (load <= 62) return 0.84;
  if (load <= 74) return 0.76;
  if (load <= 88) return 0.7;
  return 0.64;
}

export function SaharaBillDocument(p: BillDocumentProps) {
  const s: Styles = makeStyles(p.singlePage ? fitFactor(p) : 1);
  const hasBank = !!(p.bank?.account || p.bank?.ifsc);
  return (
    <Document title={`${p.title} ${p.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.frame}>
          <View style={s.header}>
            <View style={s.logoCol}>{p.logoDataUrl ? <Image src={p.logoDataUrl} style={s.logo} /> : null}</View>
            <View style={s.headRight}>
              <Text style={s.companyName}>{p.company.name.toUpperCase()}</Text>
              <Text style={s.phones}>{(p.company.phones ?? [p.company.phone]).join("  |  ")}</Text>
              {p.company.gstin ? <Text style={[s.contactC, { textAlign: "right" }]}>GSTIN: {p.company.gstin}</Text> : null}
              <Text style={s.docTitle}>{p.title}</Text>
              {p.copyLabel ? <Text style={[s.copyBox, { marginTop: 2 }]}>{p.copyLabel}</Text> : null}
            </View>
          </View>

          <View style={s.metaStrip}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>{p.kind === "QUOTATION" ? "Quotation No." : "Invoice No."}</Text>
              <Text style={s.metaValue}>{p.number}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>{p.kind === "QUOTATION" ? "Quotation Date" : "Invoice Date"}</Text>
              <Text style={s.metaValue}>{p.date}</Text>
            </View>
            {(p.extraMeta ?? []).map((m) => (
              <View key={m.label} style={s.metaCell}>
                <Text style={s.metaLabel}>{m.label}</Text>
                <Text style={s.metaValue}>{m.value}</Text>
              </View>
            ))}
          </View>

          <View style={s.billTo}>
            <Text style={s.billToLabel}>Bill To</Text>
            <Text style={s.billName}>{p.billTo.name}</Text>
            {p.billTo.address && p.billTo.address.trim() !== "—" ? <Text style={s.billLine}>{p.billTo.address}</Text> : null}
            {p.billTo.mobile ? (
              <Text style={s.billLine}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY }}>Mobile </Text>
                {p.billTo.mobile}
              </Text>
            ) : null}
            {p.billTo.email ? (
              <Text style={s.billLine}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY }}>Email </Text>
                {p.billTo.email}
              </Text>
            ) : null}
            {(p.billTo.details ?? []).length > 0 ? (
              <Text style={s.billLine}>
                {(p.billTo.details ?? []).map((d, i) => (
                  <Text key={d.label}>
                    {i > 0 ? "   ·   " : ""}
                    <Text style={{ fontFamily: "Helvetica-Bold", color: NAVY }}>{d.label} </Text>
                    {d.value}
                  </Text>
                ))}
              </Text>
            ) : null}
          </View>

          <View style={s.tHead}>
            <Text style={[s.headTxt, s.cNo]}>No</Text>
            <Text style={[s.headTxt, s.cName]}>SERVICES</Text>
            <Text style={[s.headTxt, s.cQty]}>Qty.</Text>
            <Text style={[s.headTxt, s.cRate]}>Rate</Text>
            <Text style={[s.headTxt, s.cDisc]}>Disc.</Text>
            <Text style={[s.headTxt, s.cTotal]}>Total</Text>
          </View>
          {p.rows.map((r, i) => (
            <View key={i} style={s.tRow} wrap={false}>
              <Text style={[s.rowName, s.cNo]}>{i + 1}</Text>
              <View style={s.cName}>
                <Text style={s.rowName}>{r.name}</Text>
                {r.detail ? <Text style={s.rowDetail}>{r.detail}</Text> : null}
              </View>
              <Text style={[s.rowName, s.cQty]}>{r.qty}</Text>
              <Text style={[s.rowName, s.cRate]}>{num(r.rate)}</Text>
              <View style={s.cDisc}>
                <Text style={[s.rowName, { textAlign: "right" }]}>{r.disc ? num(r.disc) : "—"}</Text>
                {r.disc && r.rate * r.qty ? <Text style={[s.pct, { textAlign: "right" }]}>({((r.disc / (r.rate * r.qty)) * 100).toFixed(r.disc === r.rate * r.qty ? 0 : 2)}%)</Text> : null}
              </View>
              <Text style={[s.rowName, s.cTotal]}>{num(r.total)}</Text>
            </View>
          ))}
          <View style={s.tSub}>
            <Text style={s.cNo} />
            <Text style={s.cName}>SUBTOTAL</Text>
            <Text style={s.cQty}>{p.subtotalRow.qty}</Text>
            <Text style={s.cRate} />
            <Text style={s.cDisc}>{rs(p.subtotalRow.disc)}</Text>
            <Text style={s.cTotal}>{rs(p.subtotalRow.total)}</Text>
          </View>

          <View style={s.bottom}>
            <View style={s.left}>
              {p.notes.length > 0 && (
                <>
                  <Text style={[s.secTitle, { marginTop: 0 }]}>Notes</Text>
                  {p.notes.map((n, i) => (
                    <Text key={i} style={s.para}>{n}</Text>
                  ))}
                </>
              )}
              {p.exclusionsTitle && p.kindlyNote.length > 0 && (
                <>
                  <Text style={s.secTitle}>{p.exclusionsTitle}</Text>
                  {p.kindlyNote.map((n, i) => (
                    <Text key={i} style={s.para}>• {n}</Text>
                  ))}
                </>
              )}
              <Text style={s.secTitle}>Terms &amp; Conditions</Text>
              {!p.exclusionsTitle && p.kindlyNote.length > 0 && (
                <>
                  <Text style={s.para}>Kindly Note:</Text>
                  {p.kindlyNote.map((n, i) => (
                    <Text key={i} style={s.para}>{i + 1}) {n}</Text>
                  ))}
                </>
              )}
              <Text style={s.para}>{p.terms}</Text>
            </View>
            <View style={s.right}>
              <View style={s.totalBox}>
                <Text style={s.totalLbl}>Total Amount</Text>
                <Text style={s.totalVal}>{rs(p.totals.total)}</Text>
              </View>
              {p.totals.discount > 0 ? (
                <>
                  <View style={s.kv}><Text style={s.kvL}>Base Amount</Text><Text style={s.kvR}>{rs(p.totals.subtotal)}</Text></View>
                  <View style={s.kv}><Text style={s.kvL}>Discount</Text><Text style={s.kvR}>- {rs(p.totals.discount)}</Text></View>
                </>
              ) : null}
              {p.totals.complimentary ? (
                <View style={s.kv}><Text style={s.kvL}>Complimentary (free)</Text><Text style={s.kvR}>{rs(p.totals.complimentary)}</Text></View>
              ) : null}
              {p.totals.gstAmount ? (
                <View style={s.kv}><Text style={s.kvL}>GST ({p.totals.gstPercent}%) included</Text><Text style={s.kvR}>{rs(p.totals.gstAmount)}</Text></View>
              ) : null}
              {p.totals.received !== undefined && (
                <>
                  <View style={s.kv}><Text style={s.kvL}>Received Amount</Text><Text style={s.kvR}>{rs(p.totals.received)}</Text></View>
                  <View style={[s.kv, { marginBottom: 8 }]}><Text style={s.kvBold}>Balance</Text><Text style={s.kvBold}>{rs(p.totals.balance ?? 0)}</Text></View>
                </>
              )}
              {p.paymentSplit ? (
                <View style={s.splitBox} wrap={false}>
                  <Text style={[s.secTitle, { marginTop: 0 }]}>Payment Terms</Text>
                  <View style={s.kv}><Text style={s.kvBold}>Advance ({p.paymentSplit.percent}%) — to confirm booking</Text><Text style={s.kvBold}>{rs(p.paymentSplit.advance)}</Text></View>
                  <View style={s.kv}><Text style={s.kvL}>Balance ({p.paymentSplit.balancePercent}%) — after work completion</Text><Text style={s.kvR}>{rs(p.paymentSplit.balance)}</Text></View>
                </View>
              ) : null}
              <Text style={s.secTitle}>Total Amount (in words)</Text>
              <Text style={s.words}>{p.amountInWords}</Text>
              {hasBank && (
                <>
                  <Text style={s.secTitle}>Bank Details</Text>
                  {p.bank?.name ? <View style={s.bankGrid}><Text style={s.bankK}>Name</Text><Text style={s.bankV}>{p.bank.name}</Text></View> : null}
                  {p.bank?.ifsc ? <View style={s.bankGrid}><Text style={s.bankK}>IFSC</Text><Text style={s.bankV}>{p.bank.ifsc}</Text></View> : null}
                  {p.bank?.account ? <View style={s.bankGrid}><Text style={s.bankK}>Account No</Text><Text style={s.bankV}>{p.bank.account}</Text></View> : null}
                  {p.bank?.bankName ? <View style={s.bankGrid}><Text style={s.bankK}>Bank Name</Text><Text style={s.bankV}>{p.bank.bankName}</Text></View> : null}
                </>
              )}
              {(p.qrDataUrl || p.upiId) && (
                <View style={s.payRow} wrap={false}>
                  {p.qrDataUrl ? <Image src={p.qrDataUrl} style={s.qr} /> : null}
                  <View>
                    <Text style={[s.secTitle, { marginTop: 0 }]}>Payment QR Code</Text>
                    {p.upiId ? (
                      <Text style={s.kvR}>
                        <Text style={{ fontFamily: "Helvetica-Bold" }}>UPI ID: </Text>
                        {p.upiId}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={s.footer} wrap={false}>
            <View style={s.signRow}>
              <View style={s.signBox}>
                <Text style={s.signLbl}>Authorised Signatory</Text>
                <Text style={s.signName}>{p.company.name.toUpperCase()}</Text>
              </View>
            </View>
            <View style={s.servicesBar}>
              <Text style={s.footSlogan}>{p.company.slogan ?? SLOGAN}</Text>
              <Text style={s.servicesTxt}>{(p.services ?? CORE_SERVICES).join("  •  ")}</Text>
              <Text style={s.footContact}>{(p.company.phones ?? [p.company.phone]).join("  |  ")}  ·  {p.company.email}  ·  {p.company.website}</Text>
              <Text style={s.footContact}>{p.company.address}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
