// Short customer links /q /i /p /b and the v6 confirmation template (owner 2026-10-24). Run: npx tsx --test tests/short-links.test.ts
// Synthetic data; throwaway DB; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-sl-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let sl: typeof import("../src/server/short-links");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  sl = await import("../src/server/short-links");
});
test.after(async () => { await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

let n = 0;
const mkJob = (extra: Record<string, unknown> = {}) => db.job.create({ data: { jobNumber: `SL-${++n}`, customerName: "Asha", customerMobile: "9811111111", address: "a", area: "Baner", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 5000, status: "ASSIGNED", ...extra } as never });

test("codes: 10 letters/digits, unique per job, created once and stable; the URL uses the booking host", async () => {
  const a = await mkJob();
  const b = await mkJob();
  const ca = await sl.ensureShortCode(a.id);
  assert.match(ca, /^[A-Za-z0-9]{10}$/);
  assert.equal(await sl.ensureShortCode(a.id), ca, "stable");
  assert.notEqual(await sl.ensureShortCode(b.id), ca);
  assert.equal(new Set(Array.from({ length: 500 }, () => sl.newShortCode())).size, 500, "no repeats in 500 draws");
  assert.match(sl.shortUrl("q", ca), new RegExp(`/q/${ca}$`));
  assert.ok(!/^https?:\/\/[^/]+\/(booking|quotation)/.test(sl.shortUrl("i", ca)));
});

test("targets: /q → quotation PDF when the enquiry has a quotation (else the web quotation); /i → invoice PDF once invoiced (else the booking page); /p → pay page; /b → booking page", async () => {
  const lead = await db.lead.create({ data: { leadNumber: "L-SL1", name: "Asha", mobile: "9811111111", area: "Baner", service: "HOME_DEEP_CLEANING", source: "CALL" } as never });
  const withQuote = await mkJob({ leadId: lead.id });
  await db.quotation.create({ data: { quoteNumber: "Q-SL1", leadId: lead.id, services: "[]", subTotal: 1, totalAmount: 1, terms: "t" } });
  const plain = await mkJob();
  const cq = await sl.ensureShortCode(withQuote.id);
  const cp = await sl.ensureShortCode(plain.id);
  const tq = (await db.job.findUniqueOrThrow({ where: { id: withQuote.id } })).publicToken;
  assert.equal(tq, null, "no token yet");
  const q = await sl.shortLinkTarget("q", cq);
  const token = (await db.job.findUniqueOrThrow({ where: { id: withQuote.id } })).publicToken!;
  assert.equal(q, `/booking/quotation/${token}/pdf`);
  assert.equal(await sl.shortLinkTarget("p", cq), `/booking/pay/${token}`);
  assert.equal(await sl.shortLinkTarget("b", cq), `/booking/${token}`);
  assert.equal(await sl.shortLinkTarget("i", cq), `/booking/${token}`, "no invoice yet");
  await db.invoice.create({ data: { invoiceNumber: "INV-SL1", jobId: withQuote.id, customerName: "Asha", lineItems: "[]", subTotal: 1, totalAmount: 1 } as never });
  assert.equal(await sl.shortLinkTarget("i", cq), `/booking/invoice/${token}/pdf`);
  const tp = (await sl.shortLinkTarget("q", cp))!;
  assert.match(tp, /^\/booking\/quotation\/[A-Za-z0-9_-]{20,}$/, "no CRM quotation: the web quotation, not an error");
});

test("bad or unknown codes are plain 404s; deleted jobs are not reachable; wrong length / characters never hit the database", async () => {
  assert.equal(await sl.shortLinkTarget("q", "short"), null);
  assert.equal(await sl.shortLinkTarget("q", "has space!!"), null);
  assert.equal(await sl.shortLinkTarget("q", "AAAAAAAAAA"), null);
  const j = await mkJob();
  const code = await sl.ensureShortCode(j.id);
  await db.job.update({ where: { id: j.id }, data: { deletedAt: new Date() } });
  assert.equal(await sl.shortLinkTarget("p", code), null);
});

test("v6 template: exactly TWO URL buttons on short links, both phone numbers and /connect in the text, no phone button; wired into submit + transactional lists", async () => {
  const { templateByName } = await import("../src/lib/whatsapp-cloud-templates");
  const { SUBMITTABLE_TEMPLATES } = await import("../src/lib/meta-template-payload");
  const { WHATSAPP_TRANSACTIONAL_TEMPLATES } = await import("../src/lib/whatsapp");
  const t = templateByName("sahara_booking_confirmed_v6")!;
  assert.deepEqual((t.buttons ?? []).map((b) => [b.type, b.text]), [["URL", "View Quotation"], ["URL", "Pay Advance"]]);
  const urls = (t.buttons ?? []).flatMap((b) => ("url" in b ? [b.url] : []));
  assert.ok(urls[0].endsWith("/q/{{1}}") && urls[1].endsWith("/p/{{1}}"));
  assert.ok(t.body.includes("7083347130 | 8956567130") && t.body.includes("/connect"));
  assert.equal((t.body.match(/\{\{\d\}\}/g) ?? []).length, 6);
  assert.ok((SUBMITTABLE_TEMPLATES as readonly string[]).includes("sahara_booking_confirmed_v6"));
  assert.ok(WHATSAPP_TRANSACTIONAL_TEMPLATES.includes("sahara_booking_confirmed_v6"));
});

test("routes: short routes redirect to the PUBLIC origin and are rate-limited; the customer PDF routes and the middleware allow-list exist", () => {
  for (const k of ["q", "i", "p", "b"]) {
    const src = readFileSync(`src/app/${k}/[code]/route.ts`, "utf8");
    assert.match(src, /new URL\(target, PUBLIC_BOOKING_URL\)/);
    assert.match(src, /rateLimit\(/);
  }
  assert.match(readFileSync("src/app/booking/quotation/[token]/pdf/route.ts", "utf8"), /quotationPdfForToken/);
  assert.match(readFileSync("src/app/booking/invoice/[token]/pdf/route.ts", "utf8"), /invoicePdfForToken/);
  const mw = readFileSync("src/middleware.ts", "utf8");
  for (const p of ['"/q/"', '"/i/"', '"/p/"', '"/b/"']) assert.ok(mw.split(p).length >= 3, `${p} allowed on the booking host and public`);
});
