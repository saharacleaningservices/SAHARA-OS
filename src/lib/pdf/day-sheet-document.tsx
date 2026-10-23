import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DaySheetRow } from "@/server/day-sheet";

// Landscape A4 day sheet in the Sahara navy / gold style. No customer name, phone or amount (see src/server/day-sheet.ts).
const NAVY = "#1f2f66";
const GOLD = "#c9a961";
const MUTED = "#5b6478";

const s = StyleSheet.create({
  page: { padding: 24, fontSize: 8.5, color: NAVY, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 8, marginBottom: 8 },
  logo: { width: 90, height: 40, objectFit: "contain" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 9, color: MUTED, marginTop: 2 },
  tHead: { flexDirection: "row", backgroundColor: NAVY, color: "#ffffff", paddingVertical: 5, paddingHorizontal: 4 },
  tRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#d9dce6" },
  cJob: { width: "11%" },
  cTime: { width: "9%" },
  cSvc: { width: "19%", paddingRight: 4 },
  cAddr: { width: "27%", paddingRight: 4 },
  cTeam: { width: "21%", paddingRight: 4 },
  cStatus: { width: "13%" },
  bold: { fontFamily: "Helvetica-Bold" },
  small: { fontSize: 7.5, color: MUTED },
  empty: { marginTop: 40, textAlign: "center", color: MUTED, fontSize: 11 },
  footer: { position: "absolute", bottom: 14, left: 24, right: 24, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED },
});

export type DaySheetProps = { dateLabel: string; companyName: string; logoDataUrl?: string | null; rows: DaySheetRow[]; generatedAt: string };

export function DaySheetDocument({ dateLabel, companyName, logoDataUrl, rows, generatedAt }: DaySheetProps) {
  return (
    <Document title={`Day sheet ${dateLabel}`}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header} fixed>
          <View>
            <Text style={s.title}>Day Sheet — {dateLabel}</Text>
            <Text style={s.sub}>{companyName} · {rows.length} job{rows.length === 1 ? "" : "s"}</Text>
          </View>
          {logoDataUrl ? <Image src={logoDataUrl} style={s.logo} /> : null}
        </View>
        <View style={s.tHead} fixed>
          <Text style={[s.cJob, s.bold]}>Job</Text>
          <Text style={[s.cTime, s.bold]}>Time</Text>
          <Text style={[s.cSvc, s.bold]}>Service</Text>
          <Text style={[s.cAddr, s.bold]}>Location</Text>
          <Text style={[s.cTeam, s.bold]}>Team / crew</Text>
          <Text style={[s.cStatus, s.bold]}>Status</Text>
        </View>
        {rows.length === 0 ? <Text style={s.empty}>No jobs scheduled for this day.</Text> : null}
        {rows.map((r) => (
          <View key={r.jobNumber} style={s.tRow} wrap={false}>
            <Text style={[s.cJob, s.bold]}>{r.jobNumber}</Text>
            <Text style={s.cTime}>{r.time}</Text>
            <View style={s.cSvc}>
              <Text>{r.service}</Text>
              {r.packageLabel ? <Text style={s.small}>{r.packageLabel}</Text> : null}
            </View>
            <View style={s.cAddr}>
              <Text style={s.bold}>{r.area}</Text>
              <Text style={s.small}>{r.address}</Text>
            </View>
            <View style={s.cTeam}>
              <Text>{[r.team, r.crew.join(", ")].filter(Boolean).join(" · ") || "Not assigned"}</Text>
              {r.supervisor ? <Text style={s.small}>Supervisor: {r.supervisor}</Text> : null}
            </View>
            <Text style={s.cStatus}>{r.status}</Text>
          </View>
        ))}
        <View style={s.footer} fixed>
          <Text>Team copy — no customer phone or amounts.</Text>
          <Text>Generated {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
