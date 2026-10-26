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
  label: { fontSize: 8, color: "#5b7186", marginBottom: 2, textTransform: "uppercase" },
  value: { fontSize: 11, fontWeight: 700 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#eef3fa" },
  lineLabel: { fontSize: 10 },
  lineValue: { fontSize: 10, fontWeight: 700 },
  netRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#e7f0fd", padding: 10, borderRadius: 6, marginTop: 8 },
  netLabel: { fontSize: 12, fontWeight: 700 },
  netValue: { fontSize: 14, fontWeight: 700, color: "#0B5ED7" },
  footer: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#dfe7f0", fontSize: 8, color: "#5b7186", textAlign: "center" },
});

function inr(n: number) {
  return `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
}

export type PayslipPdfProps = {
  logoDataUrl: string | null;
  monthLabel: string;
  employeeCode: string;
  name: string;
  designation: string;
  mobile: string;
  wageType: string;
  baseRate: string;
  bankAccount: string | null;
  bankIfsc: string | null;
  gpayNumber: string | null;
  presentDays: number;
  absentDays: number;
  offDays: number;
  earned: number;
  rewardTotal: number;
  advanceTotal: number;
  fineTotal: number;
  netBalance: number;
  /** Money Khata extras (same engine as the CRM / Staff App). */
  openingDue?: number;
  autoFare?: number;
  autoFareEnabled?: boolean;
  salaryPaid?: number;
  adjustment?: number;
  loanRemaining?: number;
};

export function PayslipDocument(props: PayslipPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
          <Text style={styles.titleText}>SALARY SLIP</Text>
          <Text style={styles.titleMeta}>{props.monthLabel}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee</Text>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>Name</Text><Text style={styles.value}>{props.name}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Employee Code</Text><Text style={styles.value}>{props.employeeCode}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Designation</Text><Text style={styles.value}>{props.designation}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Mobile</Text><Text style={styles.value}>{props.mobile}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Wage Type</Text><Text style={styles.value}>{props.wageType}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Base Rate</Text><Text style={styles.value}>{props.baseRate}</Text></View>
            {props.bankAccount ? (
              <View style={styles.cell}><Text style={styles.label}>Bank A/C</Text><Text style={styles.value}>{props.bankAccount}{props.bankIfsc ? ` (${props.bankIfsc})` : ""}</Text></View>
            ) : null}
            {props.gpayNumber ? (
              <View style={styles.cell}><Text style={styles.label}>Google Pay</Text><Text style={styles.value}>{props.gpayNumber}</Text></View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <View style={styles.row}>
            <View style={styles.cell}><Text style={styles.label}>Present Days</Text><Text style={styles.value}>{props.presentDays}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Absent Days</Text><Text style={styles.value}>{props.absentDays}</Text></View>
            <View style={styles.cell}><Text style={styles.label}>Off / Leave</Text><Text style={styles.value}>{props.offDays}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings & Deductions</Text>
          {props.openingDue ? (
            <View style={styles.lineRow}><Text style={styles.lineLabel}>Balance brought forward</Text><Text style={styles.lineValue}>{props.openingDue < 0 ? "- " : ""}{inr(Math.abs(props.openingDue))}</Text></View>
          ) : null}
          <View style={styles.lineRow}><Text style={styles.lineLabel}>Earned Wage</Text><Text style={styles.lineValue}>{inr(props.earned)}</Text></View>
          {props.autoFareEnabled ? (
            <>
              <View style={styles.lineRow}><Text style={styles.lineLabel}>Auto Fare</Text><Text style={styles.lineValue}>+ {inr(props.autoFare ?? 0)}</Text></View>
              <View style={styles.lineRow}><Text style={styles.lineLabel}>Total Payable (wage + auto fare)</Text><Text style={styles.lineValue}>{inr(props.earned + (props.autoFare ?? 0))}</Text></View>
            </>
          ) : null}
          <View style={styles.lineRow}><Text style={styles.lineLabel}>Bonus / Incentives</Text><Text style={styles.lineValue}>+ {inr(props.rewardTotal)}</Text></View>
          {props.adjustment ? (
            <View style={styles.lineRow}><Text style={styles.lineLabel}>Adjustment</Text><Text style={styles.lineValue}>{props.adjustment < 0 ? "- " : "+ "}{inr(Math.abs(props.adjustment))}</Text></View>
          ) : null}
          {props.salaryPaid !== undefined ? (
            <View style={styles.lineRow}><Text style={styles.lineLabel}>Salary Paid</Text><Text style={styles.lineValue}>- {inr(props.salaryPaid)}</Text></View>
          ) : null}
          <View style={styles.lineRow}><Text style={styles.lineLabel}>Advance Taken</Text><Text style={styles.lineValue}>- {inr(props.advanceTotal)}</Text></View>
          <View style={styles.lineRow}><Text style={styles.lineLabel}>Deductions</Text><Text style={styles.lineValue}>- {inr(props.fineTotal)}</Text></View>
          <View style={styles.netRow}><Text style={styles.netLabel}>{props.netBalance < 0 ? "Advance Outstanding" : "Salary Due"}</Text><Text style={styles.netValue}>{inr(Math.abs(props.netBalance))}</Text></View>
          {props.loanRemaining ? (
            <View style={styles.lineRow}><Text style={styles.lineLabel}>Loan remaining (separate, not deducted)</Text><Text style={styles.lineValue}>{inr(props.loanRemaining)}</Text></View>
          ) : null}
        </View>

        <Text style={styles.footer}>
          This is a system-generated salary slip from Sahara OS — {props.monthLabel}. For queries contact the office.
        </Text>
      </Page>
    </Document>
  );
}
