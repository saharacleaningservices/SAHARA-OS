// PDF export of one party's ledger statement. Not a "use server" module.
import { renderToBuffer } from "@react-pdf/renderer";
import { PartyLedgerDocument } from "@/lib/pdf/party-ledger-document";
import { resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";
import { COMPANY } from "@/lib/constants";
import { SLOGAN } from "@/lib/pdf/sahara-bill-document";
import { getCompanySettings } from "@/server/settings";
import { formatDate } from "@/lib/utils";
import { ledgerFileSafe } from "@/server/party-ledger-export";
import type { PartyLedger } from "@/server/party-ledger";

const money = (n: number) => (n ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

export async function ledgerPdf(l: PartyLedger): Promise<{ buffer: Buffer; filename: string }> {
  const settings = await getCompanySettings();
  const logoDataUrl = await resolveBrandLogoDataUrl(settings.logoUrl);
  const bal = l.ledger.balance;
  const buffer = await renderToBuffer(
    PartyLedgerDocument({
      company: { name: settings.name || COMPANY.name, slogan: SLOGAN, phones: [...COMPANY.phones], email: COMPANY.email, address: COMPANY.address },
      logoDataUrl,
      party: { name: l.name, mobile: l.mobile },
      asOf: formatDate(new Date()),
      rows: l.ledger.rows.map((r) => ({ date: formatDate(r.date), kind: r.kind, ref: r.ref, debit: money(r.debit), credit: money(r.credit), balance: `${money(Math.abs(r.balance)) || "0.00"}${r.balance < 0 ? " Cr" : r.balance > 0 ? " Dr" : ""}` })),
      totals: { billed: money(l.ledger.billed) || "0.00", received: money(l.ledger.received) || "0.00", balance: `${money(Math.abs(bal)) || "0.00"}`, balanceLabel: bal > 0 ? "Balance due from party" : bal < 0 ? "Advance held (credit)" : "Settled" },
    }),
  );
  return { buffer, filename: `Ledger-${ledgerFileSafe(l.name)}-${l.mobile}.pdf` };
}
