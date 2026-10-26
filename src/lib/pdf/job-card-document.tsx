import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/constants";
import { FONT, inr as rupee, latinDigits } from "./brand-kit";

/**
 * Mandatory staff rules printed on every team copy (owner 2026-10-25) — Hindi, so every helper on site can read them.
 * Rendered with the embedded Poppins font (Devanagari); the built-in PDF fonts cannot draw Hindi.
 */
export const STAFF_RULES_HI = [
  "समय पर साइट पहुँचें, Staff App में चेक-इन करें; यूनिफ़ॉर्म और ID कार्ड पहनना अनिवार्य है।",
  "काम शुरू करने से पहले ग्राहक के साथ निरीक्षण करें; पहले से मौजूद नुकसान या दाग की फ़ोटो लें।",
  "केवल इस जॉब कार्ड में लिखा काम करें; अतिरिक्त काम के लिए पहले सुपरवाइज़र / ऑफ़िस से मंज़ूरी लें।",
  "ग्राहक से कोई नकद, टिप या भुगतान न लें — भुगतान केवल कंपनी के UPI / बैंक खाते में होगा।",
  "कीमती सामान, नकद और गहनों को हाथ न लगाएँ; बंद अलमारी या लॉकर न खोलें।",
  "केमिकल सही मात्रा में, दस्ताने और मास्क पहनकर इस्तेमाल करें; बिजली के पॉइंट पर पानी न डालें।",
  "ग्राहक से विनम्र व्यवहार करें; साइट पर धूम्रपान, गुटखा, शराब और ऊँची आवाज़ में बात सख़्त मना है।",
  "काम पूरा होने पर ग्राहक के साथ फ़ाइनल चेक करें, Before / After फ़ोटो App में अपलोड करें और सारे उपकरण वापस लें।",
  "ग्राहक का पता या कोई भी जानकारी किसी से शेयर न करें; कोई भी समस्या हो तो तुरंत सुपरवाइज़र को कॉल करें।",
];

const styles = StyleSheet.create({
  page: { padding: 26, fontSize: 9.5, color: "#0A2540", fontFamily: FONT.regular },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  logoBox: { backgroundColor: "#0B5ED7", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  logoImg: { height: 34, width: "auto" },
  logoText: { color: "#ffffff", fontSize: 16, fontFamily: FONT.bold },
  logoSub: { color: "#dbe9fd", fontSize: 8, marginTop: 2 },
  companyMeta: { textAlign: "right", fontSize: 8, color: "#5b7186", lineHeight: 1.5 },
  titleBar: {
    backgroundColor: "#0A2540",
    color: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleText: { fontSize: 13, fontFamily: FONT.bold, letterSpacing: 1 },
  titleMeta: { fontSize: 10, color: "#dbe9fd" },
  section: { borderWidth: 1, borderColor: "#dfe7f0", borderRadius: 6, padding: 10, marginBottom: 9 },
  sectionTitle: { fontSize: 8.5, fontFamily: FONT.bold, color: "#5b7186", textTransform: "uppercase", marginBottom: 6 },
  row: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", marginBottom: 6, paddingRight: 8 },
  cellFull: { width: "100%", marginBottom: 6 },
  label: { fontSize: 8, color: "#5b7186", marginBottom: 2, textTransform: "uppercase" },
  value: { fontSize: 10.5, fontFamily: FONT.bold },
  linkValue: { fontSize: 9, color: "#0B5ED7" },
  payGrid: { flexDirection: "row", justifyContent: "space-between" },
  payCell: { width: "32%", borderWidth: 1, borderColor: "#dfe7f0", borderRadius: 4, padding: 8 },
  payLabel: { fontSize: 8, color: "#5b7186", textTransform: "uppercase" },
  payValue: { fontSize: 13, fontFamily: FONT.bold, marginTop: 2 },
  notesText: { fontSize: 10, lineHeight: 1.5 },
  rules: { borderWidth: 1.2, borderColor: "#B91C1C", borderRadius: 6, padding: 10, backgroundColor: "#FEF2F2" },
  rulesTitle: { fontFamily: FONT.bold, fontSize: 11, color: "#B91C1C", marginBottom: 5 },
  ruleRow: { flexDirection: "row", marginBottom: 3.5 },
  ruleNo: { width: 16, fontFamily: FONT.bold, fontSize: 9.5, color: "#B91C1C" },
  ruleText: { flex: 1, fontSize: 9.5, lineHeight: 1.45, color: "#0A2540" },
  footer: { marginTop: "auto", paddingTop: 10, borderTopWidth: 1, borderTopColor: "#dfe7f0", fontSize: 8, color: "#5b7186", textAlign: "center" },
});

const inr = rupee; // "₹7,000" — office copy only; the team copy never shows money

export type JobCardPdfProps = {
  jobNumber: string;
  logoDataUrl: string | null;
  customerName: string;
  mobile: string;
  alternateMobile: string | null;
  /** Work site (where the job is done). */
  address: string;
  /** Client's registered / office address — office copy only, never on the team copy. */
  officeAddress?: string | null;
  mapLink: string | null;
  date: string;
  timeSlot: string;
  service: string;
  flatType: string | null;
  team: string;
  supervisor: string;
  crew?: string;
  packageName?: string | null;
  paymentStatus: string;
  jobValue: number;
  advance: number;
  balance: number;
  notes: string | null;
  /** Compact list of booked services ("Sofa Cleaning × 5 seats") — no room-by-room checklist. */
  services?: string[];
  /** Scope / instructions staff typed for the team (shown in the Staff App too). */
  instructions?: string | null;
  /** Team card — hide customer phone + payment figures. */
  audience?: "team" | "office";
};

function Field({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <View style={full ? styles.cellFull : styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "—"}</Text>
    </View>
  );
}

export function JobCardDocument(props: JobCardPdfProps) {
  const team = props.audience === "team";
  return (
    <Document title={`Job Card ${props.jobNumber}`}>
      <Page size="A4" style={styles.page} wrap={false}>
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
          </View>
        </View>

        <View style={styles.titleBar}>
          <Text style={styles.titleText}>JOB CARD{team ? " — TEAM COPY" : ""}</Text>
          <Text style={styles.titleMeta}>{props.jobNumber}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{team ? "Site" : "Customer"}</Text>
          <View style={styles.row}>
            {team ? null : <Field label="Name" value={props.customerName} />}
            {team ? null : <Field label="Mobile" value={props.mobile} />}
            {team ? null : <Field label="Alternate Number" value={props.alternateMobile || "—"} />}
            <Field label="Google Maps" value={props.mapLink ? "See link below" : "Not shared"} />
            <View style={styles.cellFull}>
              <Text style={styles.label}>Site Address / Work Location</Text>
              <Text style={styles.value}>{props.address || "—"}</Text>
            </View>
            {!team && props.officeAddress ? (
              <View style={styles.cellFull}>
                <Text style={styles.label}>Registered / Office Address</Text>
                <Text style={styles.value}>{props.officeAddress}</Text>
              </View>
            ) : null}
            {props.mapLink ? (
              <View style={styles.cellFull}>
                <Text style={styles.label}>Maps Link</Text>
                <Text style={styles.linkValue}>{props.mapLink}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Job</Text>
          <View style={styles.row}>
            <Field label="Date" value={props.date} />
            <Field label="Time Slot" value={props.timeSlot} />
            <Field label="Service" value={props.service} />
            <Field label="Flat / Type" value={props.flatType || "—"} />
            {props.packageName && !props.services?.length ? <Field label="Package" value={props.packageName} /> : null}
            <Field label="Team" value={props.team} />
            {props.crew ? <Field label="Crew" value={props.crew} /> : null}
            <Field label="Supervisor" value={props.supervisor} />
            {props.services?.length ? (
              <View style={styles.cellFull}>
                <Text style={styles.label}>Services</Text>
                {props.services.slice(0, 10).map((s, i) => (
                  <Text key={`${s}-${i}`} style={styles.value}>{`• ${s}`}</Text>
                ))}
              </View>
            ) : null}
            {props.instructions ? (
              <View style={styles.cellFull}>
                <Text style={styles.label}>Instructions</Text>
                <Text style={styles.value}>{props.instructions}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {team ? null : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.payGrid}>
              <View style={styles.payCell}>
                <Text style={styles.payLabel}>Status</Text>
                <Text style={styles.payValue}>{props.paymentStatus}</Text>
              </View>
              <View style={styles.payCell}>
                <Text style={styles.payLabel}>Advance</Text>
                <Text style={styles.payValue}>{inr(props.advance)}</Text>
              </View>
              <View style={styles.payCell}>
                <Text style={styles.payLabel}>Balance</Text>
                <Text style={styles.payValue}>{inr(props.balance)}</Text>
              </View>
            </View>
            <Text style={[styles.label, { marginTop: 8 }]}>Job Value: {inr(props.jobValue)}</Text>
          </View>
        )}

        {/* Internal office notes never go on the team copy. */}
        {!team && props.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{props.notes}</Text>
          </View>
        ) : null}

        {/* Team copy: the space below the job fills with the mandatory staff rules (owner 2026-10-25). One A4 page. */}
        {team ? (
          <View style={styles.rules} wrap={false}>
            <Text style={styles.rulesTitle}>स्टाफ के लिए अनिवार्य नियम (Staff Rules)</Text>
            {STAFF_RULES_HI.map((r, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={styles.ruleNo}>{i + 1}.</Text>
                <Text style={styles.ruleText}>{r}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer}>
          {COMPANY.name} · Generated {latinDigits(new Date().toLocaleString("en-IN-u-nu-latn", { timeZone: "Asia/Kolkata" }))}
        </Text>
      </Page>
    </Document>
  );
}
