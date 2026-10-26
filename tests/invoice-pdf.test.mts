// Sahara TAX INVOICE PDF (owner 2026-10-25): one A4 page, new columns, no QR / no static advance box, clickable social links. Run: npm run test:invoice
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
import type { InvoiceDocumentProps } from "../src/lib/pdf/sahara-invoice-document";
import { INVOICE_LEGAL_TERMS } from "../src/lib/invoice-terms";

const outDir = path.resolve("node_modules/.cache/invoice-pdf-test");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "sahara-invoice-document.mjs");
buildSync({ entryPoints: [path.resolve("src/lib/pdf/sahara-invoice-document.tsx")], bundle: true, platform: "node", format: "esm", packages: "external", outfile: outFile, jsx: "automatic", tsconfig: path.resolve("tsconfig.json"), logLevel: "silent" });
const mod = (await import(pathToFileURL(outFile).href)) as { SaharaInvoiceDocument: (p: InvoiceDocumentProps) => unknown };
const { renderToBuffer } = (await import("@react-pdf/renderer")) as { renderToBuffer: (d: unknown) => Promise<Buffer> };
const pages = (buf: Buffer) => (buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

const base: InvoiceDocumentProps = {
  number: "INV-2026-0300", date: "25 Oct 2026", jobId: "JOB-2026-0310",
  stampDataUrl: `data:image/png;base64,${readFileSync("public/stamp.png").toString("base64")}`,
  company: { name: "Sahara Cleaning Services", phones: ["7083347130", "8956567130"], email: "contact@saharacleaningservices.com", website: "www.saharacleaningservices.com", address: "Opp. South Gate, Magarpatta City, Hadapsar, Pune.", gstin: "27DMTPS3584R2ZJ" },
  billTo: { name: "Rahul Sharma", address: "Flat 402, Magarpatta, Pune", mobile: "9800000000" },
  rows: [{ name: "Full Home Cleaning — Premium", qty: 1, rate: 6999, total: 6999 }],
  showArea: false,
  totals: { subtotal: 6999, discount: 500, total: 6499, received: 0, balance: 6499 },
  amountInWords: "Six Thousand Four Hundred Ninety Nine Rupees",
  scope: ["Kitchen degreasing and cabinet exterior", "Bathroom descaling and sanitising", "Floor scrubbing and vacuuming"],
};
const dump = (name: string, b: Buffer) => process.env.INVOICE_PDF_DUMP && writeFileSync(path.join(process.env.INVOICE_PDF_DUMP, `${name}.pdf`), b);

test("standard invoice: ONE A4 page, TAX INVOICE badge, GSTIN, clickable social links, no QR / static advance text", async () => {
  const buf = await renderToBuffer(mod.SaharaInvoiceDocument(base));
  dump("invoice-basic", buf);
  assert.equal(pages(buf), 1);
  const raw = buf.toString("latin1");
  for (const u of ["instagram.com/saharacleaningservices.pune", "facebook.com/saharacleaningservices", "youtube.com/channel", "g.page/r/"]) assert.ok(raw.includes(u), `link ${u}`);
});

test("commercial invoice with Sq. Ft column, many lines, GST and advance still fits ONE page", async () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ name: `Office floor ${i + 1} deep cleaning`, detail: "Machine scrubbing, glass and washroom cleaning", qty: 1200 + i * 50, rate: 7, total: (1200 + i * 50) * 7, area: `${1200 + i * 50} sq ft` }));
  const subtotal = rows.reduce((t, r) => t + r.total, 0);
  const buf = await renderToBuffer(mod.SaharaInvoiceDocument({ ...base, rows, showArea: true, totals: { subtotal, discount: 1000, gstPercent: 18, gstAmount: 1500, total: subtotal - 1000, received: 5000, balance: subtotal - 6000 }, scope: Array.from({ length: 8 }, (_, i) => `Scope point number ${i + 1} describing the work to be carried out on site by the team`) }));
  dump("invoice-commercial", buf);
  assert.equal(pages(buf), 1);
});

test("legal terms hold only invoice / payment clauses (no cleaning or operational restrictions, no static 20% advance)", () => {
  const all = INVOICE_LEGAL_TERMS.join(" ").toLowerCase();
  for (const bad of ["20%", "advance", "stain", "furniture", "water", "electricity", "ladder", "valuables", "quotation is valid"]) assert.ok(!all.includes(bad), `no "${bad}"`);
  assert.ok(all.includes("msmed") && all.includes("pune"));
});
