import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/constants";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: "#0A2540", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  logoBox: {
    backgroundColor: "#0B5ED7",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  logoText: { color: "#ffffff", fontSize: 16, fontWeight: 700 },
  logoImg: { height: 36, width: "auto" },
  logoSub: { color: "#dbe9fd", fontSize: 8, marginTop: 2 },
  companyMeta: { textAlign: "right", fontSize: 8, color: "#5b7186", lineHeight: 1.5 },
  titleBar: {
    backgroundColor: "#0A2540",
    color: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleText: { fontSize: 13, fontWeight: 700, letterSpacing: 1 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  metaBlock: { width: "48%" },
  metaLabel: { fontSize: 8, color: "#5b7186", marginBottom: 2, textTransform: "uppercase" },
  metaValue: { fontSize: 10, marginBottom: 6, fontWeight: 700 },
  table: { borderWidth: 1, borderColor: "#dfe7f0", borderRadius: 4, marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: "#eef3fa", paddingVertical: 6, paddingHorizontal: 8 },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#eef3fa",
  },
  colName: { width: "35%", fontSize: 9, fontWeight: 700 },
  colDesc: { width: "40%", fontSize: 9, color: "#5b7186" },
  colAmount: { width: "25%", fontSize: 9, textAlign: "right", fontWeight: 700 },
  headCell: { fontSize: 8, fontWeight: 700, color: "#5b7186", textTransform: "uppercase" },
  totalsBlock: { alignSelf: "flex-end", width: "45%", marginBottom: 20 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: "#5b7186" },
  totalsValue: { fontSize: 9, fontWeight: 700 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#0B5ED7",
  },
  grandTotalLabel: { fontSize: 11, fontWeight: 700, color: "#0A2540" },
  grandTotalValue: { fontSize: 12, fontWeight: 700, color: "#0B5ED7" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  termsBlock: { width: "58%" },
  termsTitle: { fontSize: 9, fontWeight: 700, marginBottom: 4 },
  termsText: { fontSize: 8, color: "#5b7186", lineHeight: 1.6 },
  qrBlock: { width: "35%", alignItems: "center" },
  qrImage: { width: 90, height: 90, marginBottom: 4 },
  qrLabel: { fontSize: 7, color: "#5b7186", textAlign: "center" },
  bottomNote: {
    marginTop: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#dfe7f0",
    fontSize: 8,
    color: "#5b7186",
    textAlign: "center",
  },
});

export type QuotationPdfProps = {
  quoteNumber: string;
  createdAt: string;
  validTill: string;
  customerName: string;
  customerMobile: string;
  customerAddress: string;
  services: { name: string; description: string; amount: number }[];
  subTotal: number;
  discount?: number;
  gstPercent: number;
  gstAmount: number;
  totalAmount: number;
  terms: string;
  qrDataUrl: string;
  logoDataUrl?: string | null;
};

function inr(n: number) {
  return `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
}

export function QuotationDocument(props: QuotationPdfProps) {
  return (
    <Document title={`Quotation ${props.quoteNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {props.logoDataUrl ? (
            <Image src={props.logoDataUrl} style={styles.logoImg} />
          ) : (
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>Sahara</Text>
              <Text style={styles.logoSub}>Cleaning Services</Text>
            </View>
          )}
          <View style={styles.companyMeta}>
            <Text>{COMPANY.address}</Text>
            <Text>{COMPANY.phones.join("  /  ")}</Text>
            <Text>{COMPANY.website}</Text>
            <Text>GSTIN: {COMPANY.gstin}</Text>
          </View>
        </View>

        <View style={styles.titleBar}>
          <Text style={styles.titleText}>QUOTATION</Text>
          <Text style={styles.titleText}>{props.quoteNumber}</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Quotation For</Text>
            <Text style={styles.metaValue}>{props.customerName}</Text>
            <Text style={styles.metaLabel}>Mobile</Text>
            <Text style={{ fontSize: 9, marginBottom: 6 }}>{props.customerMobile}</Text>
            <Text style={styles.metaLabel}>Address</Text>
            <Text style={{ fontSize: 9 }}>{props.customerAddress}</Text>
          </View>
          <View style={[styles.metaBlock, { alignItems: "flex-end" }]}>
            <Text style={styles.metaLabel}>Date Issued</Text>
            <Text style={styles.metaValue}>{props.createdAt}</Text>
            <Text style={styles.metaLabel}>Valid Till</Text>
            <Text style={styles.metaValue}>{props.validTill}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headCell, { width: "35%" }]}>Service</Text>
            <Text style={[styles.headCell, { width: "40%" }]}>Description</Text>
            <Text style={[styles.headCell, { width: "25%", textAlign: "right" }]}>Amount</Text>
          </View>
          {props.services.map((s, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colName}>{s.name}</Text>
              <Text style={styles.colDesc}>{s.description}</Text>
              <Text style={styles.colAmount}>{inr(s.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{inr(props.subTotal)}</Text>
          </View>
          {props.discount ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount</Text>
              <Text style={styles.totalsValue}>- {inr(props.discount)}</Text>
            </View>
          ) : null}
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>GST ({props.gstPercent}%)</Text>
            <Text style={styles.totalsValue}>{inr(props.gstAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Payable</Text>
            <Text style={styles.grandTotalValue}>{inr(props.totalAmount)}</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.termsBlock}>
            <Text style={styles.termsTitle}>Terms &amp; Conditions</Text>
            <Text style={styles.termsText}>{props.terms}</Text>
          </View>
          <View style={styles.qrBlock}>
            <Image src={props.qrDataUrl} style={styles.qrImage} />
            <Text style={styles.qrLabel}>Scan to pay (UPI){"\n"}Sample QR — replace with your registered UPI ID</Text>
          </View>
        </View>

        <Text style={styles.bottomNote}>
          {COMPANY.name} · {COMPANY.address} · {COMPANY.phones.join(" / ")} · {COMPANY.website}
        </Text>
      </Page>
    </Document>
  );
}
