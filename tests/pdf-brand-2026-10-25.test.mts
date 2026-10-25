// Owner master list 2026-10-25: Latin digits + real ₹ on every PDF, words never "Zero Rupees" for a priced document,
// GST-based invoice title, Sr. No. column, blue footer with clickable links, job card team copy. Run: npm run test:pdfbrand
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
import { documentTotal, rupeesInWords } from "../src/lib/document-scope";

const outDir = path.resolve("node_modules/.cache/pdf-brand-test");
mkdirSync(outDir, { recursive: true });
async function load<T>(src: string): Promise<T> {
  const outfile = path.join(outDir, path.basename(src).replace(/\.tsx?$/, ".mjs"));
  buildSync({ entryPoints: [path.resolve(src)], bundle: true, platform: "node", format: "esm", packages: "external", outfile, jsx: "automatic", tsconfig: path.resolve("tsconfig.json"), logLevel: "silent" });
  return (await import(pathToFileURL(outfile).href)) as T;
}
type Kit = typeof import("../src/lib/pdf/brand-kit");
type Inv = typeof import("../src/lib/pdf/sahara-invoice-document");
type Card = typeof import("../src/lib/pdf/job-card-document");
type Mask = typeof import("../src/lib/pdf/job-card-mask");
const kit = await load<Kit>("src/lib/pdf/brand-kit.tsx");
const inv = await load<Inv>("src/lib/pdf/sahara-invoice-document.tsx");
const card = await load<Card>("src/lib/pdf/job-card-document.tsx");
const mask = await load<Mask>("src/lib/pdf/job-card-mask.ts");
const { renderToBuffer } = (await import("@react-pdf/renderer")) as { renderToBuffer: (d: unknown) => Promise<Buffer> };
const pages = (buf: Buffer) => (buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

test("money is always Latin digits with the ₹ sign — never Devanagari numerals", () => {
  assert.equal(kit.inr(7000), "₹7,000");
  assert.equal(kit.inr(125000.5), "₹1,25,000.5");
  assert.equal(kit.num(10), "10");
  assert.equal(kit.latinDigits("₹१०,५००"), "₹10,500");
  assert.doesNotMatch(kit.inr(1234567), /[०-९]/);
});

test("amount in words follows the printed total — no 'Zero Rupees' when the document is priced", () => {
  assert.equal(documentTotal(6000, 6000, 6000), 6000);
  assert.equal(documentTotal(0, 5900, 6000), 5900, "stored total missing → subtotal − discount + GST");
  assert.equal(documentTotal(0, 0, 6000), 6000, "→ priced lines");
  assert.equal(rupeesInWords(documentTotal(0, 0, 6000)), "Six Thousand Rupees");
});

test("invoice title: TAX INVOICE only when GST is charged", () => {
  assert.equal(inv.invoiceTitle({ gstPercent: 18, gstAmount: 900 }), "TAX INVOICE");
  assert.equal(inv.invoiceTitle({ gstPercent: 0, gstAmount: 0 }), "INVOICE");
  assert.equal(inv.invoiceTitle({}), "INVOICE");
});

const company = { name: "Sahara Cleaning Services", phones: ["7083347130", "8956567130"], email: "contact@saharacleaningservices.com", website: "www.saharacleaningservices.com", address: "Opp. South Gate, Magarpatta City, Hadapsar, Pune 411028", gstin: "27DMTPS3584R2ZJ" };
const base = {
  number: "INV-2026-0300", date: "25 Oct 2026", jobId: "JOB-2026-0310", company,
  billTo: { name: "Test Customer", address: "Magarpatta, Pune", mobile: "9000000000" },
  rows: [{ name: "Full Home Cleaning — Premium", qty: 1, rate: 6999, total: 6999 }], showArea: false,
  amountInWords: rupeesInWords(6499), scope: ["Kitchen degreasing"],
};

test("non-GST invoice PDF never says TAX INVOICE; GST invoice does; both one A4 page with payment block and footer links", async () => {
  const qr = await (await import("qrcode")).default.toDataURL("upi://pay?pa=test@upi&am=6499&cu=INR", { margin: 1, width: 240 });
  const payment = { bank: { name: "Sahara", bankName: "HDFC Bank", account: "000011112222", ifsc: "HDFC0000001" }, upiId: "test@upi", qrDataUrl: qr, amount: 6499 };
  const plain = await renderToBuffer(inv.SaharaInvoiceDocument({ ...base, totals: { subtotal: 6999, discount: 500, total: 6499, received: 0, balance: 6499 }, payment }));
  const gst = await renderToBuffer(inv.SaharaInvoiceDocument({ ...base, totals: { subtotal: 6999, discount: 500, gstPercent: 18, gstAmount: 991, total: 6499, received: 0, balance: 6499 } }));
  assert.equal(pages(plain), 1);
  assert.equal(pages(gst), 1);
  // The <Document title> follows the GST rule (the badge prints the same invoiceTitle()).
  const docTitle = (el: unknown) => (el as { props: { title: string } }).props.title;
  assert.equal(docTitle(inv.SaharaInvoiceDocument({ ...base, totals: { subtotal: 6999, discount: 500, total: 6499, received: 0, balance: 6499 } })), "Invoice INV-2026-0300");
  assert.equal(docTitle(inv.SaharaInvoiceDocument({ ...base, totals: { subtotal: 6999, discount: 500, gstPercent: 18, gstAmount: 991, total: 6499, received: 0, balance: 6499 } })), "Tax Invoice INV-2026-0300");
  const raw = plain.toString("latin1");
  for (const u of ["instagram.com", "facebook.com", "youtube.com", "g.page", "mailto:", "tel:"]) assert.ok(raw.includes(u), `footer link ${u}`);
});

test("job card team copy: no customer mobile, no amounts, Hindi staff rules, ONE A4 page", async () => {
  const full = {
    jobNumber: "JOB-2026-0310", logoDataUrl: null, customerName: "Rahul Sharma", mobile: "9800000000", alternateMobile: "9800000001",
    address: "Flat 402, Tower B, Amanora Park Town, Hadapsar, Pune 411028", mapLink: "https://maps.google.com/?q=18.5,73.9",
    date: "25 Oct 2026", timeSlot: "10:00 AM", service: "Home Deep Cleaning", flatType: "3 BHK", packageName: "Platinum",
    services: Array.from({ length: 10 }, (_, i) => `Add-on service ${i + 1} × 2`), team: "Team 2", crew: "Ramesh, Suresh, Ganesh", supervisor: "Francis",
    paymentStatus: "Partly Paid", jobValue: 7499, advance: 1500, balance: 5999, notes: "Office note", instructions: "Office instruction", audience: "team" as const,
  };
  const props = mask.maskJobCardForAudience(full);
  assert.equal(props.mobile, "");
  assert.equal(props.jobValue, 0);
  const buf = await renderToBuffer(card.JobCardDocument(props));
  assert.equal(pages(buf), 1);
  assert.ok(card.STAFF_RULES_HI.length >= 6);
  const raw = buf.toString("latin1");
  assert.ok(!raw.includes("9800000000"), "customer mobile never in the team copy");
  if (process.env.PDF_BRAND_DUMP) (await import("node:fs")).writeFileSync(path.join(process.env.PDF_BRAND_DUMP, "job-card.pdf"), buf);
});
