import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/constants";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", color: "#0A2540" },
  border: {
    borderWidth: 2,
    borderColor: "#0B5ED7",
    borderRadius: 8,
    padding: 32,
    height: "100%",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  logoBox: { backgroundColor: "#0B5ED7", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  logoText: { color: "#ffffff", fontSize: 16, fontWeight: 700 },
  logoSub: { color: "#dbe9fd", fontSize: 8, marginTop: 2 },
  logoImg: { height: 36, width: "auto" },
  certNo: { fontSize: 9, color: "#5b7186" },
  titleWrap: { alignItems: "center", marginBottom: 28 },
  title: { fontSize: 22, fontWeight: 700, color: "#0A2540", letterSpacing: 2 },
  subtitle: { fontSize: 10, color: "#5b7186", marginTop: 6 },
  bodyText: { fontSize: 12, textAlign: "center", lineHeight: 1.8, marginBottom: 28, paddingHorizontal: 20 },
  customerName: { fontSize: 18, fontWeight: 700, color: "#0B5ED7" },
  detailsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 40 },
  detailBlock: { alignItems: "center" },
  detailLabel: { fontSize: 8, color: "#5b7186", textTransform: "uppercase", marginBottom: 3 },
  detailValue: { fontSize: 10, fontWeight: 700 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  signBlock: { width: "40%", alignItems: "center" },
  signImage: { width: 120, height: 45, objectFit: "contain", marginBottom: 4 },
  signLine: { borderTopWidth: 1, borderTopColor: "#0A2540", width: "100%", marginTop: 30, paddingTop: 4 },
  signLabel: { fontSize: 8, color: "#5b7186", textAlign: "center" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#5b7186" },
});

export type CertificatePdfProps = {
  certificateNumber: string;
  issuedDate: string;
  customerName: string;
  serviceSummary: string;
  supervisorName: string | null;
  signatureUrl: string | null;
  signatureDataUrl?: string | null;
  logoDataUrl?: string | null;
};

export function CertificateDocument(props: CertificatePdfProps) {
  return (
    <Document title={`Certificate ${props.certificateNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.border}>
          <View style={styles.headerRow}>
            {props.logoDataUrl ? (
              <Image src={props.logoDataUrl} style={styles.logoImg} />
            ) : (
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>Sahara</Text>
                <Text style={styles.logoSub}>Cleaning Services</Text>
              </View>
            )}
            <Text style={styles.certNo}>Certificate No: {props.certificateNumber}{"\n"}Issued: {props.issuedDate}</Text>
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.title}>CERTIFICATE OF COMPLETION</Text>
            <Text style={styles.subtitle}>This certifies that the service described below has been completed satisfactorily</Text>
          </View>

          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <Text style={styles.customerName}>{props.customerName}</Text>
          </View>

          <Text style={styles.bodyText}>{props.serviceSummary}</Text>

          <View style={styles.detailsRow}>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Supervised By</Text>
              <Text style={styles.detailValue}>{props.supervisorName ?? "—"}</Text>
            </View>
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Company</Text>
              <Text style={styles.detailValue}>{COMPANY.name}</Text>
            </View>
          </View>

          <View style={styles.signRow}>
            <View style={styles.signBlock}>
              {props.signatureDataUrl ? (
                <Image src={props.signatureDataUrl} style={styles.signImage} />
              ) : (
                <View style={{ height: 45 }} />
              )}
              <View style={styles.signLine}>
                <Text style={styles.signLabel}>Customer Signature</Text>
              </View>
            </View>
            <View style={styles.signBlock}>
              <View style={{ height: 45 }} />
              <View style={styles.signLine}>
                <Text style={styles.signLabel}>Authorized Signatory — {COMPANY.name}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>
            {COMPANY.address} · {COMPANY.phones.join(" / ")} · {COMPANY.website}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
