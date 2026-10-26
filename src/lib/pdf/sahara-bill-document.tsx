import { Document, Image, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { COMPANY } from "../constants";
import { BrandFooter, FONT, PaymentBlock, SignatoryBox, formatPhoneIN, hasPaymentBlock, inr, num as fmtNum } from "./brand-kit";

// One professional layout for Sahara quotations and invoices (MyBillBook-style
// structure: framed page, brand header, number/date strip, Bill To, service
// table with Qty / Rate / Disc. / Total, subtotal band, Notes + Terms on the
// left, totals + amount in words + signatory on the right, payment QR).
// Rendered on demand — nothing is stored on the server.

export const SLOGAN = "Your Trusted Home Service Partner";
export const CORE_SERVICES = ["Home Deep Cleaning", "Commercial Cleaning", "Interior Painting", "Pest Control", "Housekeeping & AMC"];

const GOLD = "#9db0dc"; // frame / rule lines — soft royal blue (was gold), matching the blue invoice
const NAVY = "#24325a";
const MUTED = "#5b6478";
const BEIGE = "#eff4ff";
const ROYAL = "#1E40AF"; // footer strip (owner 2026-10-24)

// k < 1 only for single-page quotations (see fitFactor); invoices render at k = 1, exactly as before.
function makeStyles(k: number) {
  const z = (n: number) => Math.round(n * k * 10) / 10;
  return StyleSheet.create({
  page: { padding: z(22), fontSize: z(9), color: NAVY, fontFamily: FONT.regular },
  frame: { borderWidth: 1, borderColor: ROYAL, flexGrow: 1 },
  // Header (owner 2026-10-26): logo LEFT · name + tagline CENTRE · GSTIN/SAC → badge → copy label → +91 numbers RIGHT.
  headerC: { flexDirection: "row", alignItems: "center", paddingHorizontal: z(16), paddingTop: z(12), paddingBottom: z(10), borderBottomWidth: 1, borderBottomColor: GOLD },
  headLogoCol: { width: z(104), justifyContent: "center", alignItems: "flex-start" },
  headMidCol: { flexGrow: 1, flexShrink: 1, alignItems: "center", paddingHorizontal: z(8) },
  headRightCol: { width: z(172), alignItems: "flex-end" },
  gstR: { fontFamily: FONT.bold, fontSize: z(8.4), color: NAVY, marginBottom: z(4), textAlign: "right" },
  phonesR: { fontFamily: FONT.medium, fontSize: z(8.4), color: NAVY, marginTop: z(3), textAlign: "right" },
  logoSm: { width: z(100), height: z(50), objectFit: "contain" },
  companyNameC: { fontFamily: FONT.bold, fontSize: z(21), letterSpacing: z(0.6), lineHeight: 1.15, color: ROYAL, textAlign: "center" },
  phonesC: { fontFamily: FONT.bold, fontSize: z(9.5), color: NAVY, marginTop: z(1), textAlign: "center" },
  titleBadge: { marginTop: 0, backgroundColor: ROYAL, color: "#ffffff", fontFamily: FONT.bold, fontSize: z(10.5), letterSpacing: z(1.5), paddingVertical: z(2.5), paddingHorizontal: z(16), borderRadius: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: z(18), paddingTop: z(12), paddingBottom: z(8), borderBottomWidth: 1, borderBottomColor: GOLD },
  headRight: { flexGrow: 1, flexShrink: 1, alignItems: "flex-end", paddingLeft: z(10) },
  docTitle: { fontFamily: FONT.bold, fontSize: z(14), color: NAVY, letterSpacing: 1, marginTop: z(4) },
  slogan: { fontFamily: FONT.italic, fontSize: z(10), color: MUTED, marginTop: z(3), textAlign: "center" },
  phones: { fontFamily: FONT.bold, fontSize: z(9.5), color: NAVY, marginTop: z(2), textAlign: "right" },
  contactC: { fontFamily: FONT.bold, fontSize: z(8.5), color: NAVY, marginBottom: z(1), textAlign: "center" },
  titleBar: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: z(5), borderBottomWidth: 1, borderBottomColor: GOLD, backgroundColor: BEIGE },
  titleC: { fontSize: z(12), fontFamily: FONT.bold, color: NAVY, letterSpacing: 1 },
  // Logo in its own fixed box (scaled to fit, never overflowing), company text in the remaining width — they can't overlap.
  logoCol: { width: z(150), height: z(52), marginBottom: z(2), justifyContent: "center", alignItems: "flex-start" },
  logo: { width: z(146), height: z(50), objectFit: "contain" },
  companyCol: { flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  companyName: { fontFamily: FONT.bold, fontSize: z(16), letterSpacing: z(0.3), lineHeight: 1.15, color: NAVY, textAlign: "right" },
  tagline: { fontSize: z(9), color: MUTED, marginTop: z(2), marginBottom: z(6) },
  contact: { fontSize: z(8.5), color: NAVY, marginBottom: z(2) },
  titleCol: { width: z(110), flexShrink: 0, alignItems: "flex-end" },
  title: { fontSize: z(13), fontFamily: FONT.bold, color: NAVY },
  copyBox: { marginTop: z(4), borderWidth: 0.8, borderColor: MUTED, paddingHorizontal: z(5), paddingVertical: z(2), fontSize: z(6.5), color: MUTED },
  metaStrip: { flexDirection: "row", paddingHorizontal: z(18), paddingVertical: z(9), borderBottomWidth: 1, borderBottomColor: GOLD },
  metaCell: { marginRight: z(32) },
  metaLabel: { fontFamily: FONT.bold, fontSize: z(9.5), marginBottom: z(2) },
  metaValue: { fontSize: z(9.5), color: MUTED },
  billTo: { paddingHorizontal: z(18), paddingVertical: z(10) },
  billToLabel: { fontFamily: FONT.bold, fontSize: z(10), marginBottom: z(2) },
  billName: { fontSize: z(11.5), marginBottom: z(2) },
  billLine: { fontSize: z(9.5), color: MUTED, marginBottom: z(2) },
  // Boxed grid (owner 2026-10-26): header, rows and SUBTOTAL sit in one bordered box with thin column rules.
  tbl: { marginHorizontal: z(18), borderWidth: 1, borderColor: ROYAL, flexGrow: 1 }, // grows into spare page height, like a myBillBook items box
  tHead: { flexDirection: "row", backgroundColor: BEIGE, paddingVertical: z(6) },
  tRow: { flexDirection: "row", paddingVertical: z(6), borderTopWidth: 1, borderTopColor: GOLD },
  tSub: { flexDirection: "row", backgroundColor: BEIGE, paddingVertical: z(6), borderTopWidth: 1, borderTopColor: ROYAL, fontFamily: FONT.bold },
  notesBox: { borderWidth: 1, borderColor: ROYAL, borderRadius: 0, padding: z(6), marginBottom: z(4) },
  notesWrap: { marginHorizontal: z(18), marginTop: z(8) },
  notesP: { fontSize: z(9.5), color: NAVY, lineHeight: 1.35, marginBottom: z(1.5) },
  cNo: { width: "9%", paddingHorizontal: z(4), borderRightWidth: 1, borderRightColor: GOLD },
  cName: { width: "39%", paddingHorizontal: z(4), borderRightWidth: 1, borderRightColor: GOLD },
  cQty: { width: "10%", textAlign: "right", paddingHorizontal: z(4), borderRightWidth: 1, borderRightColor: GOLD },
  cRate: { width: "14%", textAlign: "right", paddingHorizontal: z(4), borderRightWidth: 1, borderRightColor: GOLD },
  cDisc: { width: "13%", textAlign: "right", paddingHorizontal: z(4), borderRightWidth: 1, borderRightColor: GOLD },
  cTotal: { width: "15%", textAlign: "right", paddingHorizontal: z(4) },
  headTxt: { fontSize: z(9.5), fontFamily: FONT.bold },
  rowName: { fontSize: z(10) },
  rowDetail: { fontSize: z(8.5), color: MUTED, marginTop: z(1) },
  pct: { fontSize: z(7), color: MUTED },
  bottom: { flexDirection: "row", paddingHorizontal: z(18), paddingTop: z(4), paddingBottom: z(10) },
  left: { width: "52%", paddingRight: 14 },
  right: { width: "48%" },
  secTitle: { fontFamily: FONT.bold, fontSize: z(10), marginBottom: z(3), marginTop: z(6) },
  para: { fontSize: z(9), color: MUTED, lineHeight: 1.35, marginBottom: z(1.5) },
  totalBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: GOLD, paddingVertical: z(6), flexDirection: "row", justifyContent: "space-between", marginBottom: z(6) },
  totalLbl: { fontFamily: FONT.bold, fontSize: z(11) },
  totalVal: { fontFamily: FONT.bold, fontSize: z(11) },
  kv: { flexDirection: "row", justifyContent: "space-between", marginBottom: z(2) },
  kvL: { fontSize: z(9.5), color: MUTED },
  kvR: { fontSize: z(9.5) },
  kvBold: { fontSize: z(9.5), fontFamily: FONT.bold },
  words: { fontSize: z(9.5), color: MUTED, marginBottom: z(8) },
  splitBox: { borderWidth: 1, borderColor: ROYAL, borderRadius: 0, padding: z(4), marginTop: z(4), marginBottom: z(6) },
  footer: { marginTop: "auto" },
  signRow: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: z(18), paddingBottom: z(6) },
  servicesBar: { backgroundColor: ROYAL, paddingVertical: z(6), paddingHorizontal: z(10) },
  footSlogan: { color: "#ffffff", fontFamily: FONT.italic, fontSize: z(10.5), textAlign: "center", marginBottom: z(2) },
  footContact: { color: "#ffffff", fontSize: z(7.5), textAlign: "center", marginTop: z(1) },
  servicesTxt: { color: "#ffffff", fontSize: z(8), textAlign: "center", letterSpacing: 0.3 },
  signBox: { width: z(170), borderWidth: 1, borderColor: GOLD, borderRadius: 0, height: z(46), justifyContent: "flex-end", alignItems: "center", paddingBottom: z(5) },
  signLbl: { fontFamily: FONT.bold, fontSize: z(8.5) },
  signName: { fontSize: z(8), color: MUTED },
  payRow: { flexDirection: "row", alignItems: "center", marginTop: z(6) },
  // Fixed 78 pt (2.75 cm) whatever the page scale: the code itself stays above 2.5 cm and keeps its white quiet zone.
  qr: { width: 78, height: 78, borderWidth: 1, borderColor: GOLD, borderRadius: 0, padding: 1.5, marginRight: z(10), backgroundColor: "#ffffff" },
  bankGrid: { flexDirection: "row", marginBottom: z(1) },
  bankK: { width: 64, fontSize: z(8), fontFamily: FONT.bold },
  bankV: { fontSize: z(8), color: MUTED, flexShrink: 1 },
  legal: { fontSize: z(7.5), color: MUTED, fontFamily: FONT.italic, marginTop: z(4), lineHeight: 1.35 },
  waBtn: { marginTop: z(6), borderWidth: 1, borderColor: "#25D366", borderRadius: 6, backgroundColor: "#e9fbf0", paddingVertical: z(5), paddingHorizontal: z(8), textDecoration: "none" },
  waTitle: { fontFamily: FONT.bold, fontSize: z(9), color: "#128C4A", textAlign: "center" },
  waSub: { fontSize: z(7.5), color: MUTED, textAlign: "center", marginTop: z(1) },
});
}

type Styles = ReturnType<typeof makeStyles>;
const rs = inr; // "₹7,000" — exact, Latin digits always (brand-kit)
const num = fmtNum;

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
  /** Company seal (data URL of public/stamp.png) printed inside the signatory box. */
  stampDataUrl?: string | null;
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
  /** Amount the UPI QR carries (printed under the code). */
  qrAmount?: number | null;
  /** Quotations: fit everything on ONE A4 page (fonts / spacing scale down with the amount of text). */
  singlePage?: boolean;
  /** When set, the kindly-note lines print under this heading (before Terms) as bullets, e.g. "Not Included (Exclusions)". */
  exclusionsTitle?: string;
  /** Statutory line printed under the Terms (quotations: the MSMED Act 2006 delayed-payment clause). */
  legalNote?: string;
  /** Clickable "Confirm on WhatsApp" box in the right column (quotations): a wa.me link with the quote number prefilled. */
  whatsappConfirm?: { url: string; display: string } | null;
};

/** Rough line count of the longest column + table rows → scale factor for a single A4 page. Verified by tests/quotation-pdf.test.mts. */
export function fitFactor(p: Pick<BillDocumentProps, "rows" | "notes" | "kindlyNote" | "terms"> & Partial<Pick<BillDocumentProps, "paymentSplit" | "bookQrDataUrl" | "billTo" | "bank" | "qrDataUrl" | "upiId" | "totals" | "legalNote" | "whatsappConfirm">>): number {
  const wrap = (t: string, per: number) => Math.max(1, Math.ceil(t.length / per)) * 1;
  // Service Scope Notes now span the full width (owner 2026-10-26), so they wrap at ~100 characters.
  const left = p.notes.reduce((n, t) => n + wrap(t, 100), 0) + p.kindlyNote.reduce((n, t) => n + wrap(t, 66), 0) + p.terms.split("\n").reduce((n, t) => n + wrap(t, 66), 0);
  const table = p.rows.reduce((n, r) => n + (r.detail ? 2.6 : 1.7), 0);
  // Payment-terms box, booking QR footer and the extra Bill To lines (email, property / service) take fixed space.
  const extra =
    (p.paymentSplit ? 4 : 0) + 4 + (p.billTo?.email ? 1 : 0) + ((p.billTo?.details ?? []).length ? 1 : 0) +
    // Right column on invoices: bank details, payment QR, received / balance and GST lines.
    // Full-width payment block (bank left, QR right) + signatory stamp box + icon footer (owner 2026-10-25).
    (p.bank?.account || p.bank?.ifsc || p.qrDataUrl || p.upiId ? 6 : 0) + 8 + (p.totals?.received !== undefined ? 6 : 0) + 3 + (p.totals?.gstAmount ? 1 : 0) + (p.totals?.discount ? 2 : 0) +
    // Quotation extras: MSMED line under the terms, WhatsApp confirm box in the right column.
    (p.legalNote ? wrap(p.legalNote, 66) : 0) + (p.whatsappConfirm ? 3 : 0) + 8;
  const load = (left + table * 1.4 + extra) * 1.56; // Poppins sets taller than Helvetica (type sizes raised 2026-10-26)
  if (load <= 24) return 1.16; // short quotations grow (type, line height, padding) so the A4 page is filled without gaps
  if (load <= 32) return 1.08;
  if (load <= 40) return 1;
  if (load <= 50) return 0.92;
  if (load <= 62) return 0.84;
  if (load <= 74) return 0.76;
  if (load <= 88) return 0.7;
  if (load <= 104) return 0.64;
  if (load <= 120) return 0.59;
  if (load <= 136) return 0.54;
  if (load <= 152) return 0.5;
  return 0.46;
}

export function SaharaBillDocument(p: BillDocumentProps) {
  const k = p.singlePage ? fitFactor(p) : 1;
  const s: Styles = makeStyles(k);
  return (
    <Document title={`${p.title} ${p.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.frame}>
          <View style={s.headerC}>
            <View style={s.headLogoCol}>{p.logoDataUrl ? <Image src={p.logoDataUrl} style={s.logoSm} /> : null}</View>
            <View style={s.headMidCol}>
              <Text style={s.companyNameC}>{p.company.name.toUpperCase()}</Text>
              <Text style={s.slogan}>{SLOGAN}</Text>
            </View>
            <View style={s.headRightCol}>
              {p.company.gstin ? <Text style={s.gstR}>GSTIN: {p.company.gstin}  |  SAC: {COMPANY.sac}</Text> : null}
              <Text style={s.titleBadge}>{p.title}</Text>
              {p.copyLabel ? <Text style={[s.copyBox, { marginTop: 3 }]}>{p.copyLabel}</Text> : null}
              <Text style={s.phonesR}>{(p.company.phones ?? [p.company.phone]).map(formatPhoneIN).join("  |  ")}</Text>
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
                <Text style={{ fontFamily: FONT.bold, color: NAVY }}>Mobile </Text>
                {p.billTo.mobile}
              </Text>
            ) : null}
            {p.billTo.email ? (
              <Text style={s.billLine}>
                <Text style={{ fontFamily: FONT.bold, color: NAVY }}>Email </Text>
                {p.billTo.email}
              </Text>
            ) : null}
            {(p.billTo.details ?? []).length > 0 ? (
              <Text style={s.billLine}>
                {(p.billTo.details ?? []).map((d, i) => (
                  <Text key={d.label}>
                    {i > 0 ? "   ·   " : ""}
                    <Text style={{ fontFamily: FONT.bold, color: NAVY }}>{d.label} </Text>
                    {d.value}
                  </Text>
                ))}
              </Text>
            ) : null}
          </View>

          <View style={s.tbl}>
          <View style={s.tHead}>
            <Text style={[s.headTxt, s.cNo]}>Sr. No.</Text>
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
          <View style={[s.tRow, { flexGrow: 1, paddingVertical: 0 }]} wrap={false}>
            <Text style={s.cNo}> </Text>
            <Text style={s.cName}> </Text>
            <Text style={s.cQty}> </Text>
            <Text style={s.cRate}> </Text>
            <Text style={s.cDisc}> </Text>
            <Text style={s.cTotal}> </Text>
          </View>
          <View style={s.tSub}>
            <Text style={s.cNo} />
            <Text style={s.cName}>SUBTOTAL</Text>
            <Text style={s.cQty}>{p.subtotalRow.qty}</Text>
            <Text style={s.cRate} />
            <Text style={s.cDisc}>{rs(p.subtotalRow.disc)}</Text>
            <Text style={s.cTotal}>{rs(p.subtotalRow.total)}</Text>
          </View>
          </View>

          {p.notes.length > 0 && (
            <View style={s.notesWrap}>
              <View style={s.notesBox}>
                <Text style={[s.secTitle, { marginTop: 0 }]}>Service Scope Notes</Text>
                {p.notes.map((n, i) => (
                  <Text key={i} style={s.notesP}>{n}</Text>
                ))}
              </View>
            </View>
          )}

          <View style={s.bottom}>
            <View style={s.left}>
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
              {p.legalNote ? <Text style={s.legal}>{p.legalNote}</Text> : null}
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
              {p.whatsappConfirm ? (
                <Link src={p.whatsappConfirm.url} style={s.waBtn}>
                  <Text style={s.waTitle}>Confirm this quotation on WhatsApp</Text>
                  <Text style={s.waSub}>Tap here · {p.whatsappConfirm.display}</Text>
                </Link>
              ) : null}
              <Text style={s.secTitle}>Total Amount (in words)</Text>
              <Text style={s.words}>{p.amountInWords}</Text>
              {/* Payment block (owner 2026-10-25): bank details left, large scannable UPI QR right — no raw URLs. */}
              {hasPaymentBlock(p) ? <PaymentBlock bank={p.bank} upiId={p.upiId} qrDataUrl={p.qrDataUrl} amount={p.qrAmount} k={k} /> : null}
            </View>
          </View>

          <View style={s.footer} wrap={false}>
            <View style={s.signRow}>
              <SignatoryBox company={p.company.name} stampDataUrl={p.stampDataUrl} k={k} />
            </View>
            <BrandFooter phones={p.company.phones ?? [p.company.phone]} email={p.company.email} website={p.company.website} address={p.company.address} k={k} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
