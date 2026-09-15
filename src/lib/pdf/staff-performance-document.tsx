import { Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import { COMPANY } from "@/lib/constants";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8, color: "#0A2540", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  logoBox: { backgroundColor: "#0B5ED7", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  logoImg: { height: 28, width: "auto" },
  logoText: { color: "#ffffff", fontSize: 14, fontWeight: 700 },
  logoSub: { color: "#dbe9fd", fontSize: 7, marginTop: 2 },
  companyMeta: { textAlign: "right", fontSize: 7, color: "#5b7186", lineHeight: 1.5 },
  titleBar: {
    backgroundColor: "#0A2540",
    color: "#ffffff",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  titleText: { fontSize: 12, fontWeight: 700, letterSpacing: 1 },
  titleMeta: { fontSize: 9, color: "#dbe9fd" },
  table: { borderWidth: 1, borderColor: "#dfe7f0", borderRadius: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#eef3fa", borderBottomWidth: 1, borderBottomColor: "#dfe7f0" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eef3fa", alignItems: "center" },
  th: { fontSize: 7, fontWeight: 700, color: "#5b7186", textTransform: "uppercase", padding: 5 },
  td: { fontSize: 8, padding: 5 },
  tdSub: { fontSize: 6, color: "#5b7186", paddingHorizontal: 5, paddingBottom: 4 },
  colName: { width: "18%" },
  colNum: { width: "7%", textAlign: "right" },
  colWide: { width: "8%", textAlign: "right" },
  totalRow: { flexDirection: "row", backgroundColor: "#e7f0fd" },
  footer: { marginTop: 14, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#dfe7f0", fontSize: 7, color: "#5b7186", textAlign: "center" },
});

function inr(n: number) {
  return `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
}

export type StaffPerformanceRow = {
  id: string;
  name: string;
  employeeCode: string;
  designation: string;
  jobsCompleted: number;
  revenueGenerated: number;
  onTimePercent: number | null;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  offDays: number;
  rewardTotal: number;
  fineTotal: number;
  earned: number;
  netBalance: number;
};

export type StaffPerformancePdfProps = {
  logoDataUrl: string | null;
  monthLabel: string;
  rows: StaffPerformanceRow[];
};

export function StaffPerformanceDocument(props: StaffPerformancePdfProps) {
  const totals = props.rows.reduce(
    (acc, r) => ({
      jobsCompleted: acc.jobsCompleted + r.jobsCompleted,
      revenueGenerated: acc.revenueGenerated + r.revenueGenerated,
      rewardTotal: acc.rewardTotal + r.rewardTotal,
      fineTotal: acc.fineTotal + r.fineTotal,
      earned: acc.earned + r.earned,
      netBalance: acc.netBalance + r.netBalance,
    }),
    { jobsCompleted: 0, revenueGenerated: 0, rewardTotal: 0, fineTotal: 0, earned: 0, netBalance: 0 },
  );

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.logoBox}>
            {props.logoDataUrl ? (
              <Image src={props.logoDataUrl} style={styles.logoImg} />
            ) : (
              <>
                <Text style={styles.logoText}>Sahara</Text>
                <Text style={styles.logoSub}>Cleaning Services</Text>
              </>
            )}
          </View>
          <View style={styles.companyMeta}>
            <Text>{COMPANY.name}</Text>
            <Text>{COMPANY.address}</Text>
            <Text>{COMPANY.phones.join(" / ")}</Text>
            <Text>{COMPANY.website}</Text>
          </View>
        </View>

        <View style={styles.titleBar}>
          <Text style={styles.titleText}>STAFF PERFORMANCE REPORT</Text>
          <Text style={styles.titleMeta}>{props.monthLabel}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colName]}>Staff</Text>
            <Text style={[styles.th, styles.colNum]}>Jobs</Text>
            <Text style={[styles.th, styles.colWide]}>Revenue</Text>
            <Text style={[styles.th, styles.colNum]}>On-time</Text>
            <Text style={[styles.th, styles.colNum]}>Present</Text>
            <Text style={[styles.th, styles.colNum]}>Half</Text>
            <Text style={[styles.th, styles.colNum]}>Absent</Text>
            <Text style={[styles.th, styles.colNum]}>Off</Text>
            <Text style={[styles.th, styles.colWide]}>Rewards</Text>
            <Text style={[styles.th, styles.colWide]}>Fines</Text>
            <Text style={[styles.th, styles.colWide]}>Earned</Text>
            <Text style={[styles.th, styles.colWide]}>Net Balance</Text>
          </View>

          {props.rows.map((r) => (
            <View style={styles.tableRow} key={r.id} wrap={false}>
              <View style={styles.colName}>
                <Text style={styles.td}>{r.name}</Text>
                <Text style={styles.tdSub}>
                  {r.employeeCode} · {r.designation}
                </Text>
              </View>
              <Text style={[styles.td, styles.colNum]}>{r.jobsCompleted}</Text>
              <Text style={[styles.td, styles.colWide]}>{inr(r.revenueGenerated)}</Text>
              <Text style={[styles.td, styles.colNum]}>{r.onTimePercent === null ? "—" : `${r.onTimePercent}%`}</Text>
              <Text style={[styles.td, styles.colNum]}>{r.presentDays}</Text>
              <Text style={[styles.td, styles.colNum]}>{r.halfDays}</Text>
              <Text style={[styles.td, styles.colNum]}>{r.absentDays}</Text>
              <Text style={[styles.td, styles.colNum]}>{r.offDays}</Text>
              <Text style={[styles.td, styles.colWide]}>{r.rewardTotal ? `+${inr(r.rewardTotal)}` : "-"}</Text>
              <Text style={[styles.td, styles.colWide]}>{r.fineTotal ? `-${inr(r.fineTotal)}` : "-"}</Text>
              <Text style={[styles.td, styles.colWide]}>{inr(r.earned)}</Text>
              <Text style={[styles.td, styles.colWide, { fontWeight: 700 }]}>{inr(r.netBalance)}</Text>
            </View>
          ))}

          <View style={styles.totalRow} wrap={false}>
            <Text style={[styles.td, styles.colName, { fontWeight: 700 }]}>Total ({props.rows.length} staff)</Text>
            <Text style={[styles.td, styles.colNum, { fontWeight: 700 }]}>{totals.jobsCompleted}</Text>
            <Text style={[styles.td, styles.colWide, { fontWeight: 700 }]}>{inr(totals.revenueGenerated)}</Text>
            <Text style={[styles.td, styles.colNum]} />
            <Text style={[styles.td, styles.colNum]} />
            <Text style={[styles.td, styles.colNum]} />
            <Text style={[styles.td, styles.colNum]} />
            <Text style={[styles.td, styles.colNum]} />
            <Text style={[styles.td, styles.colWide, { fontWeight: 700 }]}>{inr(totals.rewardTotal)}</Text>
            <Text style={[styles.td, styles.colWide, { fontWeight: 700 }]}>{inr(totals.fineTotal)}</Text>
            <Text style={[styles.td, styles.colWide, { fontWeight: 700 }]}>{inr(totals.earned)}</Text>
            <Text style={[styles.td, styles.colWide, { fontWeight: 700 }]}>{inr(totals.netBalance)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This is a system-generated staff performance report from Sahara OS — {props.monthLabel}. For queries contact the office.
        </Text>
      </Page>
    </Document>
  );
}
