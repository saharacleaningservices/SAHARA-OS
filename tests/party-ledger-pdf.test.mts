// Ledger statement PDF renders (empty and long). Run: npx tsx --test tests/party-ledger-pdf.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
import type { PartyLedgerDocProps } from "../src/lib/pdf/party-ledger-document";

const outDir = path.resolve("node_modules/.cache/party-ledger-pdf-test");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "party-ledger-document.mjs");
buildSync({ entryPoints: [path.resolve("src/lib/pdf/party-ledger-document.tsx")], bundle: true, platform: "node", format: "esm", packages: "external", outfile: outFile, jsx: "automatic", tsconfig: path.resolve("tsconfig.json"), logLevel: "silent" });
const { PartyLedgerDocument } = (await import(pathToFileURL(outFile).href)) as { PartyLedgerDocument: (p: PartyLedgerDocProps) => unknown };
const { renderToBuffer } = (await import("@react-pdf/renderer")) as { renderToBuffer: (d: unknown) => Promise<Buffer> };
const pages = (b: Buffer) => (b.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

const base = { company: { name: "Sahara Cleaning Services", slogan: "Your Trusted Home Service Partner", phones: ["7083347130", "8956567130"] }, party: { name: "Acme Traders", mobile: "9811111111" }, asOf: "24 Oct 2026", totals: { billed: "13,000.00", received: "6,500.00", balance: "6,500.00", balanceLabel: "Balance due from party" } };
const row = (i: number) => ({ date: "01 Oct 2026", kind: "Sales Invoice", ref: `SC/SL/26-27/${1000 + i}`, debit: "1,000.00", credit: "", balance: `${(i + 1) * 1000}.00 Dr` });

test("ledger statement: empty = 1 page; 120 rows flow onto several pages", async () => {
  const empty = await renderToBuffer(PartyLedgerDocument({ ...base, rows: [] }));
  const long = await renderToBuffer(PartyLedgerDocument({ ...base, rows: Array.from({ length: 120 }, (_, i) => row(i)) }));
  assert.equal(empty.subarray(0, 4).toString(), "%PDF");
  assert.equal(pages(empty), 1);
  assert.ok(pages(long) >= 3);
});
