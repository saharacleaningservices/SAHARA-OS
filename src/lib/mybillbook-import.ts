// MyBillBook "Sales Summary Report" CSV → invoice history rows (owner 2026-10-23). Pure functions: parsing, name normalisation and the
// safe-match rule. No database, no network.
//
// The report has NO phone numbers and NO service lines, only: Invoice No, Invoice Date, Contact Name, Amount, Remaining Amount,
// Invoice Status, Due Date, Invoice Link, Payment Type, Created by. So customers can only be matched by name — and a wrong match would
// put someone else's invoices on a customer's profile. The rule therefore is deliberately strict (see matchByName).
import Papa from "papaparse";

export type ParsedInvoice = {
  invoiceNo: string;
  /** Identity of the invoice: the link path. Unique per invoice even when MyBillBook reuses an invoice number. */
  invoiceKey: string;
  invoiceDate: Date;
  contactName: string;
  amount: number;
  remaining: number;
  status: string;
  invoiceLink: string;
  paymentType: string | null;
  createdByName: string | null;
  /** Customer GSTIN when the report has such a column (the GST book usually does). */
  gstin: string | null;
  /** Payment due date when the report has one. */
  dueDate: Date | null;
};

export type ParseResult = { rows: ParsedInvoice[]; skipped: { line: number; reason: string }[] };

const num = (s: string | undefined) => {
  const n = Number(String(s ?? "").replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A date as MyBillBook or Excel may print it, stored at noon IST so the calendar day is the same in any timezone. Accepts 21/10/2026,
 * 21-10-2026, 21.10.26, 2026-10-21, "21 Oct 2026" / "21-Oct-26", and an Excel serial number (e.g. 46316). Anything else is null — a day
 * and month are never guessed from an ambiguous layout other than the day-first one MyBillBook uses.
 */
export function parseDmy(s: string | undefined): Date | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  let y: number, mo: number, d: number;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) {
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[3].length === 2) y += 2000;
  } else if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = t.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[a-z]*[\s,-]+(\d{2}|\d{4})$/))) {
    d = Number(m[1]);
    mo = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    y = Number(m[3]) + (m[3].length === 2 ? 2000 : 0);
  } else if (/^\d{5}(\.\d+)?$/.test(t) && Number(t) > 30000 && Number(t) < 80000) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000); // Excel's day 0 (the 1900 leap-year quirk is already folded in after March 1900)
    [y, mo, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  } else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 6, 30)); // 12:00 IST
  return dt.getUTCDate() === d ? dt : null;
}

const LINK = /^https:\/\/(mybillbook\.in|billbk\.in)\/[A-Za-z0-9/_-]+$/;
export const invoiceKeyOf = (link: string) => link.replace(/^https:\/\/[^/]+\//, "").toLowerCase();

/** Header names accepted for each field (the GST book words some of them differently from the B2C book). First match wins. */
export const COLUMN_ALIASES = {
  no: { label: "Invoice number", required: true, names: ["invoice no", "invoice number", "invoice no."] },
  date: { label: "Invoice date", required: true, names: ["invoice date", "date"] },
  name: { label: "Customer / party name", required: true, names: ["contact name", "party name", "customer name", "party"] },
  amount: { label: "Invoice amount", required: true, names: ["amount", "total amount", "invoice amount"] },
  link: { label: "Invoice link", required: true, names: ["invoice link", "invoice url", "link"] },
  rem: { label: "Balance due", required: false, names: ["remaining amount", "balance amount", "balance", "pending amount"] },
  status: { label: "Paid / unpaid status", required: false, names: ["invoice status", "status", "payment status"] },
  due: { label: "Payment due date", required: false, names: ["due date", "payment due date"] },
  gstin: { label: "Customer GSTIN", required: false, names: ["gstin", "party gstin", "customer gstin", "gst number", "gstin/uin"] },
  pay: { label: "Payment type", required: false, names: ["payment type"] },
  by: { label: "Created by", required: false, names: ["created by"] },
} as const;
export type ColumnField = keyof typeof COLUMN_ALIASES;

function headerIndexes(head: string[]): Record<ColumnField, number> {
  const out = {} as Record<ColumnField, number>;
  for (const k of Object.keys(COLUMN_ALIASES) as ColumnField[]) out[k] = COLUMN_ALIASES[k].names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  return out;
}

/** Which column of the uploaded file feeds which field — shown to the admin before anything is imported. */
export function describeColumns(text: string): { headerFound: boolean; columns: { field: ColumnField; label: string; required: boolean; header: string | null }[]; missingRequired: string[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerAt = lines.findIndex((l) => /^invoice (no|number)\b/i.test(l.trim()));
  if (headerAt < 0) return { headerFound: false, columns: [], missingRequired: [] };
  const raw = (Papa.parse<string[]>(lines.slice(headerAt).join("\n"), { skipEmptyLines: true }).data[0] ?? []).map((h) => h.trim());
  const idx = headerIndexes(raw.map((h) => h.toLowerCase()));
  const columns = (Object.keys(COLUMN_ALIASES) as ColumnField[]).map((field) => ({ field, label: COLUMN_ALIASES[field].label, required: COLUMN_ALIASES[field].required, header: idx[field] >= 0 ? raw[idx[field]] : null }));
  return { headerFound: true, columns, missingRequired: columns.filter((c) => c.required && !c.header).map((c) => c.label) };
}

/** Finds the header row (the report has a company banner above it) and returns the invoice rows. Bad rows are listed, never guessed. */
export function parseSalesSummaryCsv(text: string): ParseResult {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);
  const headerAt = lines.findIndex((l) => /^invoice (no|number)\b/i.test(l.trim()));
  if (headerAt < 0) return { rows: [], skipped: [{ line: 0, reason: "Not a MyBillBook Sales Summary report (no 'Invoice No' header row)" }] };
  const parsed = Papa.parse<string[]>(lines.slice(headerAt).join("\n"), { skipEmptyLines: true });
  const head = (parsed.data[0] ?? []).map((h) => h.trim().toLowerCase());
  const idx = headerIndexes(head);
  if (idx.no < 0 || idx.date < 0 || idx.name < 0 || idx.amount < 0 || idx.link < 0) return { rows: [], skipped: [{ line: headerAt + 1, reason: "Missing required columns" }] };

  const rows: ParsedInvoice[] = [];
  const skipped: ParseResult["skipped"] = [];
  const seen = new Set<string>();
  parsed.data.slice(1).forEach((r, i) => {
    const line = headerAt + 2 + i;
    const invoiceNo = (r[idx.no] ?? "").trim();
    if (!invoiceNo || /^(grand\s+)?total\b/i.test(invoiceNo)) return; // blank / footer / "Total" line
    const date = parseDmy(r[idx.date]);
    const amount = num(r[idx.amount]);
    const link = (r[idx.link] ?? "").trim();
    if (!date) return void skipped.push({ line, reason: `${invoiceNo}: invalid invoice date` });
    if (!Number.isFinite(amount) || amount < 0) return void skipped.push({ line, reason: `${invoiceNo}: invalid amount` });
    if (!LINK.test(link)) return void skipped.push({ line, reason: `${invoiceNo}: invoice link is not a MyBillBook link` });
    // Two rows are the same invoice only when their LINK is the same (a repeated number alone is not a duplicate: MyBillBook reuses numbers).
    const invoiceKey = invoiceKeyOf(link);
    if (seen.has(invoiceKey)) return void skipped.push({ line, reason: `${invoiceNo}: the same invoice link appears twice in the file` });
    const rem = idx.rem >= 0 ? num(r[idx.rem]) : 0;
    seen.add(invoiceKey);
    rows.push({
      invoiceNo,
      invoiceKey,
      invoiceDate: date,
      contactName: (r[idx.name] ?? "").trim().slice(0, 160),
      amount,
      remaining: Number.isFinite(rem) ? Math.max(0, rem) : 0,
      status: /unpaid/i.test(r[idx.status] ?? "") ? "Unpaid" : /paid/i.test(r[idx.status] ?? "") ? "Paid" : (r[idx.status] ?? "").trim() || "Unknown",
      invoiceLink: link,
      paymentType: idx.pay >= 0 ? (r[idx.pay] ?? "").trim() || null : null,
      createdByName: idx.by >= 0 ? (r[idx.by] ?? "").trim() || null : null,
      dueDate: idx.due >= 0 ? parseDmy(r[idx.due]) : null,
      gstin: idx.gstin >= 0 && /^[0-9A-Z]{15}$/i.test((r[idx.gstin] ?? "").trim()) ? (r[idx.gstin] ?? "").trim().toUpperCase() : null,
    });
  });
  return { rows, skipped };
}

const TITLES = new Set(["mr", "mrs", "ms", "miss", "mx", "dr", "shri", "shree", "smt", "sri", "prof", "sir", "madam", "mam", "maam", "bhai", "ji"]);

/** "Mr. Janhavi shah" → "janhavi shah"; punctuation, case and honorifics dropped. */
export function normalizeName(name: string | null | undefined): string {
  const tokens = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && TITLES.has(tokens[0])) tokens.shift();
  while (tokens.length > 1 && TITLES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

export type NameMatch = { status: "MATCHED"; customerId: string } | { status: "REVIEW"; candidateIds: string[] } | { status: "UNMATCHED" };

/**
 * The safe rule: auto-attach only when the full name (two or more words, honorifics ignored) equals exactly ONE customer's name.
 * One-word names ("Marzi") and names shared by several customers go to the review list with their candidates.
 */
export function matchByName(contactName: string, byName: Map<string, string[]>): NameMatch {
  const key = normalizeName(contactName);
  if (!key) return { status: "UNMATCHED" };
  const ids = byName.get(key) ?? [];
  if (ids.length === 0) return { status: "UNMATCHED" };
  if (ids.length === 1 && key.split(" ").length >= 2) return { status: "MATCHED", customerId: ids[0] };
  return { status: "REVIEW", candidateIds: ids.slice(0, 8) };
}

export function indexCustomersByName(customers: { id: string; name: string }[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of customers) {
    const k = normalizeName(c.name);
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), c.id]);
  }
  return m;
}
