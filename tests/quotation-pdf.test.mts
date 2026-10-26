// Single-page standard quotation (owner wording, 17 Oct 2026): content rules + real PDF render with page count. Run: npm run test:quote
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
import QRCode from "qrcode";
import { billTable, documentScope, rupeesInWords } from "../src/lib/document-scope";
import {
  FREE_FRIDGE_NOTE,
  PREMIUM_SCOPE,
  QUOTATION_EXCLUSIONS,
  STANDARD_TERMS_LINES,
  STANDARD_TERMS_TEXT,
  packageScopeLines,
  resolveQuotationTerms,
} from "../src/lib/quotation-template";
import type { BillDocumentProps } from "../src/lib/pdf/sahara-bill-document";
import { paymentSplit } from "../src/lib/booking-payment";
import { modernizePaymentTerms, MSMED_NOTE, quotationWhatsAppLink } from "../src/lib/quotation-template";

// @react-pdf ships ESM-only subpaths that plain CJS require() cannot resolve, so the PDF component is bundled
// (own source only, packages external) into a native ESM file inside the project and imported from there.
const outDir = path.resolve("node_modules/.cache/quote-pdf-test");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "sahara-bill-document.mjs");
buildSync({ entryPoints: [path.resolve("src/lib/pdf/sahara-bill-document.tsx")], bundle: true, platform: "node", format: "esm", packages: "external", outfile: outFile, jsx: "automatic", tsconfig: path.resolve("tsconfig.json"), logLevel: "silent" });
const docMod = (await import(pathToFileURL(outFile).href)) as { SaharaBillDocument: (p: BillDocumentProps) => unknown };
const { renderToBuffer } = (await import("@react-pdf/renderer")) as { renderToBuffer: (d: unknown) => Promise<Buffer> };

const pages = (buf: Buffer) => (buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

type Line = { name: string; description: string; amount: number };
async function render(opts: { lines: Line[]; discount?: number; gstPercent?: number; terms?: string; lead?: Parameters<typeof documentScope>[0]; singlePage?: boolean; dumpName?: string; invoice?: boolean }) {
  const lead = opts.lead ?? { service: "HOME_DEEP_CLEANING", packageName: "Platinum", serviceVariant: "2 BHK Platinum" };
  const scope = documentScope(lead, { standard: true });
  const discount = opts.discount ?? 0;
  const table = billTable(opts.lines, discount);
  const subTotal = opts.lines.reduce((t, l) => t + l.amount, 0);
  const gstAmount = Math.round((((subTotal - discount) * (opts.gstPercent ?? 0)) / 100) * 100) / 100;
  const total = subTotal - discount + gstAmount;
  const qrDataUrl = await QRCode.toDataURL("upi://pay?pa=test@upi&pn=Test&am=1&cu=INR", { margin: 1, width: 240 });
  const props: BillDocumentProps = {
    kind: opts.invoice ? "INVOICE" : "QUOTATION",
    title: opts.invoice ? "TAX INVOICE" : "QUOTATION",
    copyLabel: opts.invoice ? "ORIGINAL FOR RECIPIENT" : undefined,
    bank: opts.invoice ? { name: "Sahara Cleaning Services", ifsc: "TEST0000001", account: "000011112222333", bankName: "Test Bank" } : null,
    number: "SC/QO/26-27/0001",
    date: "17/10/2026",
    extraMeta: [{ label: "Valid Till", value: "24/10/2026" }, { label: "Lead ID", value: "LD-2026-0123" }, { label: "Customer ID", value: "CUST-0042" }],
    company: { name: "Sahara Cleaning Services", tagline: "Deep Cleaning & Painting Service.", phone: "7083347130", email: "contact@saharacleaningservices.com", address: "Opposite of South gate, Magarpatta city Hadapsar Pune 411028", website: "www.saharacleaningservices.com", gstin: "27DMTPS3584R2ZJ" },
    billTo: { name: "Test Customer", address: "Flat 501, Test Society, Wadgaonsheri, Pune, Maharashtra, 411014", mobile: "9000000001", email: "test.customer@example.com", details: [{ label: "Property", value: "2 BHK Flat" }, { label: "Service", value: "Full Home Cleaning" }] },
    paymentSplit: paymentSplit(total),
    bookQrDataUrl: await QRCode.toDataURL("https://booking.example.test/booking", { margin: 1, width: 200 }),
    bookUrl: "https://booking.example.test/booking",
    rows: table.rows,
    subtotalRow: table.subtotal,
    totals: { subtotal: subTotal, discount, gstPercent: opts.gstPercent ?? 0, gstAmount, total, ...(opts.invoice ? { received: Math.round(total * 0.2), balance: total - Math.round(total * 0.2) } : {}) },
    amountInWords: rupeesInWords(total),
    notes: scope.notes,
    kindlyNote: scope.kindlyNote,
    terms: resolveQuotationTerms(opts.terms ?? STANDARD_TERMS_TEXT).text,
    logoDataUrl: `data:image/png;base64,${readFileSync("public/brand/sahara-logo@2x.png").toString("base64")}`,
    upiId: "test@upi",
    qrDataUrl,
    singlePage: opts.singlePage ?? true,
    exclusionsTitle: "Not Included (Exclusions)",
    // As printed in production (document-pdf.ts): every quotation carries the MSMED line and the WhatsApp confirm link.
    ...(opts.invoice ? {} : { legalNote: MSMED_NOTE, whatsappConfirm: quotationWhatsAppLink("SC/QO/26-27/0001") }),
  };
  const buf = await renderToBuffer(docMod.SaharaBillDocument(props));
  // QUOTE_PDF_DUMP=<dir> keeps the rendered PDFs for a visual check.
  if (process.env.QUOTE_PDF_DUMP) writeFileSync(path.join(process.env.QUOTE_PDF_DUMP, `${opts.dumpName ?? 'quote'}.pdf`), buf);
  return buf;
}

const ONE = [{ name: "Full House Cleaning Service 2 BHK Platinum package", description: "Deep cleaning", amount: 7000 }];

test("owner wording (22 Oct): premium adds appliance/chimney exterior + dry vacuuming; platinum adds wall wet + full chimney; 5 terms lines", () => {
  assert.equal(PREMIUM_SCOPE.length, 8);
  const prem = packageScopeLines("Premium").join(" ").toLowerCase();
  assert.ok(prem.includes("cobweb"));
  assert.ok(prem.includes("refrigerator") && prem.includes("microwave"), "fridge + microwave exterior");
  assert.ok(prem.includes("chimney exterior"), "Premium includes the chimney exterior");
  for (const w of ["sofa", "mattresses", "curtains", "carpets"]) assert.ok(prem.includes(w), `Premium dry-vacuums ${w}`);
  assert.ok(!prem.includes("wall wet") && !prem.includes("chimney cleaning (full)"));
  const plat = packageScopeLines("Platinum");
  assert.equal(plat.length, PREMIUM_SCOPE.length + 2);
  const platText = plat.join(" ").toLowerCase();
  assert.ok(platText.includes("wall wet cleaning") && platText.includes("chimney cleaning (full)"));
  assert.ok(PREMIUM_SCOPE.every((l) => plat.includes(l)), "Platinum keeps the full Premium scope");
  assert.equal(QUOTATION_EXCLUSIONS.length, 3);
  const ex = QUOTATION_EXCLUSIONS.join(" | ").toLowerCase();
  assert.ok(ex.includes("plastic wrap") && ex.includes("glue") && ex.includes("cement") && ex.includes("foam") && ex.includes("shampoo") && ex.includes("excluded"));
  assert.ok(!ex.includes("chimney"), "chimney is no longer an exclusion");
  assert.equal(STANDARD_TERMS_LINES.length, 5);
  const terms = STANDARD_TERMS_LINES.join(" ").toLowerCase();
  assert.ok(terms.includes("emptied") && terms.includes("step-ladder") && terms.includes("water") && terms.includes("electricity") && terms.includes("100%") && terms.includes("upi or cash") && terms.includes("final inspection"));
  assert.ok(terms.includes("valuables") && terms.includes("locked under key"));
  assert.ok(!terms.includes("minimum job value") && !terms.includes("50% advance"));
  assert.ok(terms.includes("20% advance") && terms.includes("80% balance"));
  assert.equal(FREE_FRIDGE_NOTE, "(Single Fridge Internal Deep Cleaning Included FREE for this booking)");
});

test("documentScope: standard mode prints bullets + free fridge + exclusions; default mode (invoices) is unchanged", () => {
  const std = documentScope({ service: "HOME_DEEP_CLEANING", packageName: "Platinum", serviceVariant: "2 BHK Platinum" }, { standard: true });
  assert.ok(std.notes.some((n) => n.startsWith("• Ceiling & wall dry dusting")));
  assert.ok(std.notes.some((n) => n.toLowerCase().includes("wall wet cleaning")));
  assert.ok(std.notes.includes(FREE_FRIDGE_NOTE));
  assert.deepEqual(std.kindlyNote, [...QUOTATION_EXCLUSIONS]);
  const prem = documentScope({ service: "HOME_DEEP_CLEANING", packageName: "Premium", serviceVariant: "1 BHK Premium" }, { standard: true });
  assert.ok(!prem.notes.join(" ").toLowerCase().includes("wall wet"));
  const old = documentScope({ service: "HOME_DEEP_CLEANING", packageName: "Platinum", serviceVariant: "2 BHK Platinum" });
  assert.ok(old.notes[0].startsWith("Full Home Cleaning — Platinum"), "invoice scope unchanged");
  const paint = documentScope({ service: "INTERIOR_PAINTING", scopeOfWork: "Two coats, putty and primer" }, { standard: true });
  assert.deepEqual(paint.notes, ["Two coats, putty and primer"]);
});

test("legacy default terms (50% advance / minimum value) print the standard terms; custom terms are kept", () => {
  const legacy = "1. Prices are inclusive of standard materials & labour unless stated otherwise.\n3. 50% advance payment confirms the booking.";
  assert.equal(resolveQuotationTerms(legacy).text, STANDARD_TERMS_TEXT);
  assert.equal(resolveQuotationTerms("").custom, false);
  const b2b = resolveQuotationTerms("FACILITY MANAGEMENT AMC PROPOSAL\nTERMS\n1. Monthly billing in advance.");
  assert.equal(b2b.custom, true);
  assert.ok(b2b.text.startsWith("FACILITY MANAGEMENT"));
});

test("quotations that stored the earlier 4-line standard terms (17 Oct and 18 Oct wording) still count as standard", () => {
  const four18 = [
    "1. Cabinets / wardrobes are cleaned internally ONLY if emptied by the customer before arrival.",
    "2. Customer to arrange electricity, continuous water supply and a stool / ladder.",
    "3. Old / hard stains are treated to the best of our ability (100% removal is not guaranteed without surface damage).",
    "4. Final inspection is required before the team leaves. 20% advance confirms the booking; the 80% balance is payable after work completion via UPI or Cash.",
  ].join("\n");
  const four17 = four18.replace(/4\. Final inspection[^\n]*/, "4. Final inspection is required before the team leaves. 100% payment immediately via UPI or Cash.");
  for (const stored of [four18, four17]) {
    const r = resolveQuotationTerms(stored);
    assert.equal(r.custom, false);
    assert.equal(r.text, STANDARD_TERMS_TEXT, "prints the current standard terms (now with the valuables line)");
  }
  assert.ok(STANDARD_TERMS_TEXT.includes("5. Cash, jewellery and valuables must be kept locked under key"));
});

test("typical Platinum quote renders on exactly ONE A4 page", async () => {
  assert.equal(pages(await render({ lines: ONE, dumpName: 'platinum' })), 1);
  assert.equal(pages(await render({ lines: [{ name: "Full House Cleaning Service 1 BHK Premium", description: "", amount: 4499 }], lead: { service: "HOME_DEEP_CLEANING", packageName: "Premium", serviceVariant: "1 BHK Premium" } })), 1);
});

test("worst case (7 lines, long details, discount + GST, Platinum) still renders on ONE page", async () => {
  const long = "2 × ₹599 per bathroom — extra fixtures, balcony grills, kitchen trolley, exhaust fan, chimney outer body and wardrobe tops cleaned as agreed with the customer at the time of booking";
  const lines = Array.from({ length: 6 }, (_, i) => ({ name: `Add-on service number ${i + 1}`, description: long, amount: 1198 + i }));
  const buf = await render({ lines: [...ONE, ...lines], discount: 500, gstPercent: 18, dumpName: 'worst' });
  assert.equal(pages(buf), 1, "must not spill to page 2");
});

test("non-package quote (painting) fits one page; invoice mode (singlePage off) still renders", async () => {
  const paint = { service: "INTERIOR_PAINTING", scopeOfWork: "Two coats of paint with putty and primer. Furniture covered. Free site inspection." };
  assert.equal(pages(await render({ lines: [{ name: "Interior Painting — 2 BHK", description: "", amount: 38000 }], lead: paint })), 1);
  assert.ok(pages(await render({ lines: ONE, singlePage: false })) >= 1);
});

test("invoice with bank details, payment QR, received/balance, discount and GST fits ONE A4 page (owner 2026-10-23)", async () => {
  assert.equal(pages(await render({ lines: ONE, invoice: true, discount: 700, gstPercent: 18, dumpName: "invoice" })), 1);
  const long = "2 × ₹599 per bathroom — extra fixtures, balcony grills, kitchen trolley, exhaust fan, chimney outer body and wardrobe tops cleaned as agreed with the customer at the time of booking";
  const lines = Array.from({ length: 6 }, (_, i) => ({ name: `Add-on service number ${i + 1}`, description: long, amount: 1198 + i }));
  assert.equal(pages(await render({ lines: [...ONE, ...lines], invoice: true, discount: 500, gstPercent: 18, dumpName: "invoice-worst" })), 1, "invoice must not spill to page 2");
});

test("20% advance / 80% balance: split adds up; old 50% and 100%-immediately wording prints as 20/80", () => {
  for (const t of [7000, 4499, 12345.5, 0]) {
    const p = paymentSplit(t);
    assert.equal(p.percent, 20);
    assert.equal(p.balancePercent, 80);
    assert.equal(Math.round((p.advance + p.balance) * 100), Math.round(t * 100));
  }
  assert.equal(paymentSplit(7000).advance, 1400);
  assert.equal(paymentSplit(7000).balance, 5600);
  const old17 = STANDARD_TERMS_LINES.map((l, i) => `${i + 1}. ${i === 3 ? "Final inspection is required before the team leaves. 100% payment immediately via UPI or Cash." : l}`).join("\n");
  assert.equal(resolveQuotationTerms(old17).text, STANDARD_TERMS_TEXT);
  assert.ok(modernizePaymentTerms("3. 50% advance payment confirms the booking; balance is due on job completion.").includes("20% advance"));
});

test("quotation carries the MSMED Act clause and a clickable wa.me confirm link, still on ONE A4 page (owner 2026-10-25)", async () => {
  assert.ok(MSMED_NOTE.includes("MSMED") && MSMED_NOTE.includes("2006"));
  const wa = quotationWhatsAppLink("SC/QO/26-27/0094");
  assert.ok(wa.url.startsWith("https://wa.me/917083347130?text="));
  assert.ok(decodeURIComponent(wa.url).includes("SC/QO/26-27/0094"));
  const many = Array.from({ length: 6 }, (_, i) => ({ name: `Service line ${i + 1} with a longer descriptive name`, description: "Deep cleaning", amount: 1500 + i * 100 }));
  const buf = await render({ lines: many, discount: 500, gstPercent: 18, dumpName: "quote-msmed-wa" });
  assert.equal(pages(buf), 1, "fits one page with the new lines");
  const raw = buf.toString("latin1");
  assert.ok(raw.includes("/URI") && raw.includes("wa.me/917083347130"), "the PDF holds a real link annotation to wa.me");
});
