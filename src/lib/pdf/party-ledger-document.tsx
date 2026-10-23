import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Ledger Statement for one party — Sahara navy / gold. Pure presentation: the figures come from src/lib/party-ledger.ts.
const NAVY = "#1f2f66";
const GOLD = "#c9a961";
const MUTED = "#5b6478";

const s = StyleSheet.create({
  page: { padding: 28, paddingBottom: 40, fontSize: 8.5, color: NAVY, fontFamily: "Helvetica" },
  head: { alignItems: "center", borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 8, marginBottom: 8 },
  logo: { width: 120, height: 40, objectFit: "contain" },
  company: { fontFamily: "Times-Bold", fontSize: 14, marginTop: 2 },
  slogan: { fontFamily: "Times-Italic", fontSize: 9, marginTop: 1 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 12, textAlign: "center", marginVertical: 6 },
  party: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  muted: { color: MUTED },
  bold: { fontFamily: "Helvetica-Bold" },
  tHead: { flexDirection: "row", backgroundColor: NAVY, color: "#ffffff", paddingVertical: 4, paddingHorizontal: 4 },
  tRow: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#d9dce6" },
  cDate: { width: "13%" },
  cKind: { width: "21%" },
  cRef: { width: "24%", paddingRight: 4 },
  cDr: { width: "14%", textAlign: "right" },
  cCr: { width: "14%", textAlign: "right" },
  cBal: { width: "14%", textAlign: "right" },
  totals: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalBox: { width: 210, borderTopWidth: 1, borderBottomWidth: 1, borderColor: GOLD, paddingVertical: 4 },
  line: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: MUTED },
});

export type PartyLedgerDocProps = {
  company: { name: string; slogan: string; phones: string[] };
  logoDataUrl?: string | null;
  party: { name: string; mobile: string };
  asOf: string;
  rows: { date: string; kind: string; ref: string; debit: string; credit: string; balance: string }[];
  totals: { billed: string; received: string; balance: string; balanceLabel: string };
};

export function PartyLedgerDocument(p: PartyLedgerDocProps) {
  return (
    <Document title={`Ledger statement — ${p.party.name}`}>
      <Page size="A4" style={s.page}>
        <View style={s.head} fixed>
          {p.logoDataUrl ? <Image src={p.logoDataUrl} style={s.logo} /> : null}
          <Text style={s.company}>{p.company.name.toUpperCase()}</Text>
          <Text style={s.slogan}>{p.company.slogan}</Text>
          <Text>{p.company.phones.join("  |  ")}</Text>
        </View>
        <Text style={s.title}>LEDGER STATEMENT</Text>
        <View style={s.party}>
          <View><Text style={s.bold}>{p.party.name}</Text><Text style={s.muted}>Mobile {p.party.mobile}</Text></View>
          <Text style={s.muted}>As on {p.asOf}</Text>
        </View>
        <View style={s.tHead} fixed>
          <Text style={s.cDate}>Date</Text><Text style={s.cKind}>Type</Text><Text style={s.cRef}>Reference</Text><Text style={s.cDr}>Debit</Text><Text style={s.cCr}>Credit</Text><Text style={s.cBal}>Balance</Text>
        </View>
        {p.rows.length === 0 ? <Text style={{ marginTop: 20, textAlign: "center", color: MUTED }}>No transactions yet.</Text> : null}
        {p.rows.map((r, i) => (
          <View key={i} style={s.tRow} wrap={false}>
            <Text style={s.cDate}>{r.date}</Text><Text style={s.cKind}>{r.kind}</Text><Text style={s.cRef}>{r.ref}</Text><Text style={s.cDr}>{r.debit}</Text><Text style={s.cCr}>{r.credit}</Text><Text style={s.cBal}>{r.balance}</Text>
          </View>
        ))}
        <View style={s.totals} wrap={false}>
          <View style={s.totalBox}>
            <View style={s.line}><Text>Total billed (debit)</Text><Text>{p.totals.billed}</Text></View>
            <View style={s.line}><Text>Total received (credit)</Text><Text>{p.totals.received}</Text></View>
            <View style={s.line}><Text style={s.bold}>{p.totals.balanceLabel}</Text><Text style={s.bold}>{p.totals.balance}</Text></View>
          </View>
        </View>
        <View style={s.footer} fixed>
          <Text>Debit = billed to the party · Credit = received / credited. A positive balance is what the party owes.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
