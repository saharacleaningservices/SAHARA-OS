// Customer-facing UI (autonomous brief P2/P3): invoice table headings, quotation accordions + Download PDF / Pay Now only, mobile-safe
// property pills, tidy footer. Server-rendered to static HTML and checked. Run: npx tsx --test tests/public-ui-p2.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerDocument, type CustomerDocCompany, type CustomerDocJob } from "../src/components/public/customer-document";

// The components use the JSX transform of the Next build; under tsx the classic one is used, which needs React in scope.
(globalThis as unknown as { React: typeof React }).React = React;

const company: CustomerDocCompany = {
  name: "Sahara Cleaning Services", phone: "7083347130", email: "a@b.c", address: "Pune", website: "x", logoUrl: null, upiId: "7083347130@okbizaxis", upiQrUrl: null,
  bankName: null, bankAccountName: null, bankAccountNumber: null, bankIfsc: null, upiQrDataUrl: null, payUrl: "https://booking.example/booking/pay/TOKEN",
};
const job = (over: Partial<CustomerDocJob> = {}): CustomerDocJob => ({
  jobNumber: "JOB-1", customerName: "Asha Rao", customerMobile: "9811111111", address: "Flat 2", area: "Baner", serviceLabel: "Home Deep Cleaning", packageName: "Platinum", serviceVariant: "2 BHK",
  included: [], serviceItems: null, discountAmount: 0, jobValue: 7499, scopeOfWork: null, scheduledDate: new Date("2026-11-01T06:30:00Z"), scheduledTime: "10:00 AM", createdAt: new Date("2026-10-20T06:30:00Z"),
  completedAt: null, festivalName: null, paid: 1500, invoiceNumber: null, ...over,
});
const render = (kind: "QUOTATION" | "INVOICE", j = job()) =>
  renderToStaticMarkup(createElement(CustomerDocument, { kind, job: j, company, shareUrl: "https://booking.example/x", catalog: { name: "Home Deep Cleaning", scope: ["Kitchen degreasing", "Bathroom descaling"], equipment: ["Steam machine"], terms: ["Advance 20%"] } }));

test("table headings read # | Service Description | Qty | Rate | Amount; the Disc. column only appears when a row has a discount", () => {
  const html = render("INVOICE");
  for (const h of [">#<", ">Service Description<", ">Qty<", ">Rate<", ">Amount<"]) assert.ok(html.includes(h), h);
  assert.ok(!html.includes(">Disc.<") && !html.includes(">Services<") && !html.includes(">No<"));
});

test("quotation: Scope, Equipment and Terms are collapsed accordions; only Download PDF and Pay Now (no Share)", () => {
  const html = render("QUOTATION");
  assert.equal((html.match(/<details/g) ?? []).length, 3);
  assert.ok(!/<details[^>]*\bopen\b/.test(html), "collapsed on screen");
  for (const t of ["Scope of Work", "Equipment Used", "Terms &amp; Conditions"]) assert.ok(html.includes(t), t);
  assert.ok(html.includes("Download PDF") && html.includes("Pay Now"));
  assert.ok(html.includes('href="https://booking.example/booking/pay/TOKEN"'));
  assert.ok(!html.includes("Share"));
});

test("invoice: no accordions (single compact card); fully paid invoice shows Download PDF only", () => {
  const html = render("INVOICE");
  assert.equal((html.match(/<details/g) ?? []).length, 0);
  assert.ok(html.includes("Pay Now"));
  const paid = render("INVOICE", job({ paid: 7499 }));
  assert.ok(paid.includes("Download PDF") && !paid.includes("Pay Now") && !paid.includes("Share"));
});

test("one-screen pay checkout, reschedule calendar + cancel box, property pills and footer are wired as briefed", () => {
  const view = readFileSync("src/components/public/booking-page-view.tsx", "utf8");
  assert.match(view, /if \(focus === "pay"\) \{[\s\S]*aria-label="Pay advance"[\s\S]*Advance due[\s\S]*Balance[\s\S]*Scan to pay/);
  assert.match(view, /min-h-\[100dvh\]/, "fits one screen");
  const change = readFileSync("src/components/public/booking-change-request.tsx", "utf8");
  assert.match(change, /getDateAvailability[\s\S]*getSlotAvailability/);
  assert.match(change, /filter\(\(d\) => d\.available\)/);
  assert.match(change, /filter\(\(s\) => s\.available\)/);
  assert.match(change, /Send Request/);
  const wiz = readFileSync("src/components/public/booking-wizard.tsx", "utf8");
  assert.match(wiz, /grid-cols-\[repeat\(auto-fill,minmax\(5\.25rem,1fr\)\)\][\s\S]{0,200}break-words/);
  const kit = readFileSync("src/components/public/landing-kit.tsx", "utf8");
  const trust = kit.slice(kit.indexOf('id="ft-trust"'), kit.indexOf("</footer>"));
  for (const frag of ["Serving Pune Since 2012", "GSTIN", "Privacy Policy", "Terms", "<FooterSocial />"]) assert.ok(trust.includes(frag), `${frag} grouped in the trust block`);
  assert.ok(!kit.slice(kit.indexOf('id="ft-services"'), kit.indexOf('id="ft-trust"')).includes("<FooterSocial />"));
});
