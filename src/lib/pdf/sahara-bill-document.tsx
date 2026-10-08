import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Whole words only (no "SER-VICES" hyphenation), as on Sahara’s existing documents.
Font.registerHyphenationCallback((word) => [word]);

// One professional layout for Sahara quotations and invoices (MyBillBook-style
// structure: framed page, brand header, number/date strip, Bill To, service
// table with Qty / Rate / Disc. / Total, subtotal band, Notes + Terms on the
// left, totals + amount in words + signatory on the right, payment QR).
// Rendered on demand — nothing is stored on the server.

const GOLD = "#c9a961";
const NAVY = "#24325a";
const MUTED = "#5b6478";
const BEIGE = "#faf3e6";

const s = StyleSheet.create({
  page: { padding: 22, fontSize: 9, color: NAVY, fontFamily: "Helvetica" },
  frame: { borderWidth: 1.5, borderColor: GOLD, flexGrow: 1 },
  header: { flexDirection: "row", paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: GOLD },
  logoCol: { width: 120, justifyContent: "center" },
  logo: { width: 104, height: "auto" },
  companyCol: { width: 262, paddingRight: 8 },
  companyName: { fontFamily: "Times-Bold", fontSize: 19, letterSpacing: 0.5, lineHeight: 1.15, color: NAVY },
  tagline: { fontSize: 9, color: MUTED, marginTop: 2, marginBottom: 6 },
  contact: { fontSize: 8.5, color: NAVY, marginBottom: 2 },
  titleCol: { flexGrow: 1, alignItems: "flex-end" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY },
  copyBox: { marginTop: 4, borderWidth: 0.8, borderColor: MUTED, paddingHorizontal: 5, paddingVertical: 2, fontSize: 6.5, color: MUTED },
  metaStrip: { flexDirection: "row", paddingHorizontal: 18, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: GOLD },
  metaCell: { marginRight: 32 },
  metaLabel: { fontFamily: "Helvetica-Bold", fontSize: 8.5, marginBottom: 2 },
  metaValue: { fontSize: 8.5, color: MUTED },
  billTo: { paddingHorizontal: 18, paddingVertical: 10 },
  billToLabel: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 2 },
  billName: { fontSize: 10.5, marginBottom: 2 },
  billLine: { fontSize: 8.5, color: MUTED, marginBottom: 2 },
  tHead: { flexDirection: "row", backgroundColor: BEIGE, paddingVertical: 6, paddingHorizontal: 18 },
  tRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 18 },
  tSub: { flexDirection: "row", backgroundColor: BEIGE, paddingVertical: 6, paddingHorizontal: 18, fontFamily: "Helvetica-Bold" },
  cNo: { width: "7%" },
  cName: { width: "41%", paddingRight: 6 },
  cQty: { width: "10%", textAlign: "right" },
  cRate: { width: "14%", textAlign: "right" },
  cDisc: { width: "13%", textAlign: "right" },
  cTotal: { width: "15%", textAlign: "right" },
  headTxt: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  rowName: { fontSize: 9 },
  rowDetail: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  pct: { fontSize: 7, color: MUTED },
  bottom: { flexDirection: "row", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  left: { width: "52%", paddingRight: 14 },
  right: { width: "48%" },
  secTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 3, marginTop: 6 },
  para: { fontSize: 7.5, color: MUTED, lineHeight: 1.4, marginBottom: 1.5 },
  totalBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: GOLD, paddingVertical: 6, flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  totalLbl: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  totalVal: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  kv: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  kvL: { fontSize: 8.5, color: MUTED },
  kvR: { fontSize: 8.5 },
  kvBold: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  words: { fontSize: 8.5, color: MUTED, marginBottom: 8 },
  signBox: { borderWidth: 1, borderColor: GOLD, borderRadius: 8, height: 64, justifyContent: "flex-end", alignItems: "center", paddingBottom: 8, marginTop: 4 },
  signLbl: { fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  signName: { fontSize: 8, color: MUTED },
  payRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  qr: { width: 74, height: 74, borderWidth: 1, borderColor: GOLD, borderRadius: 6, padding: 3, marginRight: 12 },
  bankGrid: { flexDirection: "row", marginBottom: 1 },
  bankK: { width: 64, fontSize: 8, fontFamily: "Helvetica-Bold" },
  bankV: { fontSize: 8, color: MUTED, flexShrink: 1 },
});

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
  company: { name: string; tagline?: string; phone: string; email: string; address: string; website: string; gstin?: string | null };
  logoDataUrl?: string | null;
  billTo: { name: string; address?: string | null; mobile?: string | null };
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
};

export function SaharaBillDocument(p: BillDocumentProps) {
  const hasBank = !!(p.bank?.account || p.bank?.ifsc);
  return (
    <Document title={`${p.title} ${p.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.frame}>
          <View style={s.header}>
            <View style={s.logoCol}>{p.logoDataUrl ? <Image src={p.logoDataUrl} style={s.logo} /> : null}</View>
            <View style={s.companyCol}>
              <Text style={s.companyName}>{p.company.name.toUpperCase()}</Text>
              {p.company.tagline ? <Text style={s.tagline}>{p.company.tagline}</Text> : null}
              <Text style={s.contact}>
                {p.company.phone} · {p.company.email}
              </Text>
              <Text style={s.contact}>{p.company.address}</Text>
              <Text style={s.contact}>{p.company.website}</Text>
              {p.company.gstin ? <Text style={s.contact}>GSTIN: {p.company.gstin}</Text> : null}
            </View>
            <View style={s.titleCol}>
              <Text style={s.title}>{p.title}</Text>
              {p.copyLabel ? <Text style={s.copyBox}>{p.copyLabel}</Text> : null}
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
              <Text style={s.secTitle}>Terms &amp; Conditions</Text>
              {p.kindlyNote.length > 0 && (
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
              <Text style={s.secTitle}>Total Amount (in words)</Text>
              <Text style={s.words}>{p.amountInWords}</Text>
              <View style={s.signBox}>
                <Text style={s.signLbl}>Authorised Signatory</Text>
                <Text style={s.signName}>{p.company.name.toUpperCase()}</Text>
              </View>
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

        </View>
      </Page>
    </Document>
  );
}
