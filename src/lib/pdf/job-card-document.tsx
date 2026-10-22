import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/constants";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: "#0A2540", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  logoBox: { backgroundColor: "#0B5ED7", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  logoImg: { height: 34, width: "auto" },
  logoText: { color: "#ffffff", fontSize: 16, fontWeight: 700 },
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
  titleMeta: { fontSize: 10, color: "#dbe9fd" },
  section: { borderWidth: 1, borderColor: "#dfe7f0", borderRadius: 6, padding: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: "#5b7186", textTransform: "uppercase", marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", marginBottom: 8, paddingRight: 8 },
  cellFull: { width: "100%", marginBottom: 8 },
  label: { fontSize: 8, color: "#5b7186", marginBottom: 2, textTransform: "uppercase" },
  value: { fontSize: 11, fontWeight: 700 },
  linkValue: { fontSize: 9, color: "#0B5ED7" },
  payGrid: { flexDirection: "row", justifyContent: "space-between" },
  payCell: { width: "32%", borderWidth: 1, borderColor: "#dfe7f0", borderRadius: 4, padding: 8 },
  payLabel: { fontSize: 8, color: "#5b7186", textTransform: "uppercase" },
  payValue: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  notesText: { fontSize: 10, lineHeight: 1.5 },
  footer: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#dfe7f0", fontSize: 8, color: "#5b7186", textAlign: "center" },
});

function inr(n: number) {
  return `Rs. ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; // exact — never rounded
}

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
                {props.services.map((s, i) => (
                  // The built-in PDF font has no "•" / "×" glyphs (same reason amounts use "Rs.").
                  <Text key={`${s}-${i}`} style={styles.value}>{`- ${s.replace(/×/g, "x")}`}</Text>
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

        <Text style={styles.footer}>
          {COMPANY.name} - Generated {new Date().toLocaleString("en-IN")}
        </Text>
      </Page>
    </Document>
  );
}
