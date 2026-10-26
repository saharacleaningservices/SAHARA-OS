// Voucher PDFs render (money voucher + delivery challan without rates). Run: npx tsx --test tests/voucher-pdf.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
import type { VoucherDocumentProps } from "../src/lib/pdf/voucher-document";

// @react-pdf is ESM-only for some subpaths: bundle our own component (packages external) into a native ESM file, as the quotation test does.
const outDir = path.resolve("node_modules/.cache/voucher-pdf-test");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "voucher-document.mjs");
buildSync({ entryPoints: [path.resolve("src/lib/pdf/voucher-document.tsx")], bundle: true, platform: "node", format: "esm", packages: "external", outfile: outFile, jsx: "automatic", tsconfig: path.resolve("tsconfig.json"), logLevel: "silent" });
const { VoucherDocument } = (await import(pathToFileURL(outFile).href)) as { VoucherDocument: (p: VoucherDocumentProps) => unknown };
const { renderToBuffer } = (await import("@react-pdf/renderer")) as { renderToBuffer: (d: unknown) => Promise<Buffer> };

const company = { name: "Sahara Cleaning Services", phone: "7083347130", email: "a@b.c", address: "Pune", website: "x" };
const fmt = (n: number) => `Rs. ${n}`;
const pages = (b: Buffer) => (b.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

test("a GST proforma and a delivery challan both render as one-page PDFs", async () => {
  const money = await renderToBuffer(VoucherDocument({ title: "PROFORMA INVOICE", number: "PF/26-27/0001", date: "23 Oct 2026", partyLabel: "Bill To", company, party: { name: "Acme", gstin: "27ABCDE1234F1Z5" }, lines: [{ name: "Deep Cleaning", qty: 1, rate: 10000, amount: 10000 }], hasMoney: true, totals: { subTotal: 10000, discount: 0, isGst: true, gstPercent: 18, gstAmount: 1800, totalAmount: 11800 }, fmt, words: "Eleven thousand eight hundred rupees only" }));
  const challan = await renderToBuffer(VoucherDocument({ title: "DELIVERY CHALLAN", number: "DC/26-27/0001", date: "23 Oct 2026", partyLabel: "Deliver To", company, party: { name: "Acme" }, lines: [{ name: "Drum", qty: 3, rate: 0, amount: 0 }], hasMoney: false, totals: { subTotal: 0, discount: 0, isGst: false, gstPercent: 0, gstAmount: 0, totalAmount: 0 }, fmt }));
  for (const b of [money, challan]) {
    assert.equal(b.subarray(0, 4).toString(), "%PDF");
    assert.equal(pages(b), 1);
  }
});
