// Excel export of one party's ledger statement (Ledger + Summary + Item-wise sheets). Not a "use server" module. The PDF lives in
// party-ledger-pdf.ts so this file stays free of the PDF renderer.
import * as XLSX from "xlsx";
import type { PartyLedger } from "@/server/party-ledger";

const day = (d: Date) => new Date(d.getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
export const ledgerFileSafe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "party";

export function ledgerWorkbook(l: PartyLedger): { buffer: Buffer; filename: string } {
  const wb = XLSX.utils.book_new();
  const rows = l.ledger.rows.map((r) => ({ Date: day(r.date), Type: r.kind, Reference: r.ref, Note: r.note ?? "", Debit: r.debit || "", Credit: r.credit || "", Balance: r.balance }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No transactions yet" }]), "Ledger");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Party: l.name, Mobile: l.mobile, "Total billed": l.ledger.billed, "Total received": l.ledger.received, Balance: l.ledger.balance }]), "Summary");
  const items = l.items.map((i) => ({ Item: i.item, Quantity: i.qty, Amount: i.amount, Documents: i.documents, "Last date": day(i.lastDate) }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items.length ? items : [{ Item: "No items yet" }]), "Item-wise");
  return { buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer, filename: `Ledger-${ledgerFileSafe(l.name)}-${l.mobile}.xlsx` };
}

