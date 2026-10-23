// Party (customer) ledger — myBillBook style: every sale is a debit, every receipt / credit note a credit, with a running balance.
// Pure functions only (no database); the data is gathered in src/server/party-ledger.ts.
export type LedgerEntry = { date: Date; kind: string; ref: string; note?: string | null; debit: number; credit: number };
export type LedgerRow = LedgerEntry & { balance: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Oldest first; on the same day the sale comes before its receipt. Balance > 0 = the party owes us; < 0 = we hold their advance. */
export function buildLedger(entries: LedgerEntry[]) {
  const sorted = [...entries]
    .filter((e) => e.debit > 0 || e.credit > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || (b.debit > 0 ? 1 : 0) - (a.debit > 0 ? 1 : 0));
  let bal = 0;
  const rows: LedgerRow[] = sorted.map((e) => {
    bal = r2(bal + e.debit - e.credit);
    return { ...e, balance: bal };
  });
  const billed = r2(rows.reduce((s, r) => s + r.debit, 0));
  const received = r2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, billed, received, balance: r2(billed - received) };
}

export type ItemLine = { name: string; qty: number; amount: number; date: Date; doc: string };
export type ItemRow = { item: string; qty: number; amount: number; documents: number; lastDate: Date };

/** Item-wise report: the same service across invoices is one row (case / spacing ignored), biggest first. */
export function aggregateItems(lines: ItemLine[]): ItemRow[] {
  const by = new Map<string, ItemRow & { docs: Set<string> }>();
  for (const l of lines) {
    const name = l.name.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = by.get(key) ?? { item: name, qty: 0, amount: 0, documents: 0, lastDate: l.date, docs: new Set<string>() };
    cur.qty += l.qty > 0 ? l.qty : 1;
    cur.amount = r2(cur.amount + l.amount);
    cur.docs.add(l.doc);
    if (l.date > cur.lastDate) cur.lastDate = l.date;
    by.set(key, cur);
  }
  return [...by.values()].map(({ docs, ...r }) => ({ ...r, documents: docs.size })).sort((a, b) => b.amount - a.amount || a.item.localeCompare(b.item));
}
