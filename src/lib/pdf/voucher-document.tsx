import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// One simple A4 layout for Proforma Invoice, Credit Note, Delivery Challan and Purchase Voucher (Sahara gold / navy frame).
// Delivery challans show quantities only — no rates or totals.
const GOLD = "#c9a961";
const NAVY = "#24325a";
const MUTED = "#5b6478";
const BEIGE = "#faf3e6";

const s = StyleSheet.create({
  page: { padding: 22, fontSize: 9, color: NAVY, fontFamily: "Helvetica" },
  frame: { borderWidth: 1.5, borderColor: GOLD, flexGrow: 1 },
  header: { flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: GOLD },
  logoCol: { width: 112, height: 60, marginRight: 12 },
  logo: { width: 108, height: 56, objectFit: "contain" },
  company: { flexGrow: 1, flexShrink: 1 },
  companyName: { fontFamily: "Times-Bold", fontSize: 16 },
  small: { fontSize: 8.5, color: MUTED, marginTop: 2 },
  titleCol: { width: 150, alignItems: "flex-end" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  strip: { flexDirection: "row", padding: 12, borderBottomWidth: 1, borderBottomColor: GOLD },
  cell: { marginRight: 28 },
  label: { fontFamily: "Helvetica-Bold", fontSize: 8.5, marginBottom: 2 },
  value: { fontSize: 8.5, color: MUTED },
  party: { padding: 12 },
  partyName: { fontSize: 11, marginBottom: 2 },
  tHead: { flexDirection: "row", backgroundColor: BEIGE, paddingVertical: 6, paddingHorizontal: 12 },
  tRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: "#e5dcc6" },
  cNo: { width: "7%" },
  cName: { width: "47%", paddingRight: 6 },
  cQty: { width: "12%", textAlign: "right" },
  cRate: { width: "17%", textAlign: "right" },
  cAmt: { width: "17%", textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  totals: { alignSelf: "flex-end", width: 220, padding: 12 },
  tLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  tTotal: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderBottomWidth: 1, borderColor: GOLD, paddingVertical: 5, marginTop: 3 },
  notes: { paddingHorizontal: 12, paddingVertical: 6 },
  sign: { marginTop: "auto", padding: 16, flexDirection: "row", justifyContent: "space-between" },
});

export type VoucherDocumentProps = {
  title: string;
  number: string;
  date: string;
  partyLabel: string;
  company: { name: string; phone: string; email: string; address: string; website: string; gstin?: string | null };
  logoDataUrl?: string | null;
  party: { name: string; mobile?: string | null; gstin?: string | null; address?: string | null };
  refLabel?: string;
  refNumber?: string | null;
  dueDate?: string | null;
  lines: { name: string; description?: string; qty: number; rate: number; amount: number }[];
  hasMoney: boolean;
  totals: { subTotal: number; discount: number; isGst: boolean; gstPercent: number; gstAmount: number; totalAmount: number; paidAmount?: number };
  fmt: (n: number) => string;
  words?: string;
  notes?: string | null;
  cancelled?: boolean;
};

export function VoucherDocument(p: VoucherDocumentProps) {
  const t = p.totals;
  return (
    <Document title={`${p.title} ${p.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.frame}>
          <View style={s.header}>
            <View style={s.logoCol}>{p.logoDataUrl ? <Image src={p.logoDataUrl} style={s.logo} /> : null}</View>
            <View style={s.company}>
              <Text style={s.companyName}>{p.company.name.toUpperCase()}</Text>
              <Text style={s.small}>{p.company.phone} · {p.company.email}</Text>
              <Text style={s.small}>{p.company.address}</Text>
              {p.company.gstin ? <Text style={s.small}>GSTIN: {p.company.gstin}</Text> : null}
            </View>
            <View style={s.titleCol}>
              <Text style={s.title}>{p.title}</Text>
              {p.cancelled ? <Text style={[s.small, s.bold]}>CANCELLED</Text> : null}
            </View>
          </View>
          <View style={s.strip}>
            <View style={s.cell}><Text style={s.label}>Number</Text><Text style={s.value}>{p.number}</Text></View>
            <View style={s.cell}><Text style={s.label}>Date</Text><Text style={s.value}>{p.date}</Text></View>
            {p.refNumber ? <View style={s.cell}><Text style={s.label}>{p.refLabel ?? "Reference"}</Text><Text style={s.value}>{p.refNumber}</Text></View> : null}
            {p.dueDate ? <View style={s.cell}><Text style={s.label}>Due</Text><Text style={s.value}>{p.dueDate}</Text></View> : null}
          </View>
          <View style={s.party}>
            <Text style={s.label}>{p.partyLabel}</Text>
            <Text style={s.partyName}>{p.party.name}</Text>
            {p.party.mobile ? <Text style={s.small}>Mobile: {p.party.mobile}</Text> : null}
            {p.party.gstin ? <Text style={s.small}>GSTIN: {p.party.gstin}</Text> : null}
            {p.party.address ? <Text style={s.small}>{p.party.address}</Text> : null}
          </View>
          <View style={s.tHead}>
            <Text style={[s.cNo, s.bold]}>No</Text>
            <Text style={[s.cName, s.bold]}>Item</Text>
            <Text style={[s.cQty, s.bold]}>Qty</Text>
            {p.hasMoney ? <Text style={[s.cRate, s.bold]}>Rate</Text> : null}
            {p.hasMoney ? <Text style={[s.cAmt, s.bold]}>Amount</Text> : null}
          </View>
          {p.lines.map((l, i) => (
            <View key={i} style={s.tRow} wrap={false}>
              <Text style={s.cNo}>{i + 1}</Text>
              <View style={s.cName}>
                <Text>{l.name}</Text>
                {l.description ? <Text style={s.small}>{l.description}</Text> : null}
              </View>
              <Text style={s.cQty}>{l.qty}</Text>
              {p.hasMoney ? <Text style={s.cRate}>{p.fmt(l.rate)}</Text> : null}
              {p.hasMoney ? <Text style={s.cAmt}>{p.fmt(l.amount)}</Text> : null}
            </View>
          ))}
          {p.hasMoney ? (
            <View style={s.totals}>
              <View style={s.tLine}><Text>Sub total</Text><Text>{p.fmt(t.subTotal)}</Text></View>
              {t.discount > 0 ? <View style={s.tLine}><Text>Discount</Text><Text>- {p.fmt(t.discount)}</Text></View> : null}
              {t.isGst ? <View style={s.tLine}><Text>CGST ({t.gstPercent / 2}%)</Text><Text>{p.fmt(t.gstAmount / 2)}</Text></View> : null}
              {t.isGst ? <View style={s.tLine}><Text>SGST ({t.gstPercent / 2}%)</Text><Text>{p.fmt(t.gstAmount / 2)}</Text></View> : null}
              <View style={s.tTotal}><Text style={s.bold}>Total</Text><Text style={s.bold}>{p.fmt(t.totalAmount)}</Text></View>
              {t.paidAmount ? <View style={[s.tLine, { marginTop: 3 }]}><Text>Paid</Text><Text>{p.fmt(t.paidAmount)}</Text></View> : null}
              {p.words ? <Text style={[s.small, { marginTop: 4 }]}>{p.words}</Text> : null}
            </View>
          ) : null}
          {p.notes ? <View style={s.notes}><Text style={s.label}>Notes</Text><Text style={s.value}>{p.notes}</Text></View> : null}
          <View style={s.sign}>
            <Text style={s.small}>{p.hasMoney ? (t.isGst ? "Tax invoice details as per GST rules." : "No GST charged.") : "Goods / service delivered as listed above."}</Text>
            <Text style={s.small}>Authorised signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
