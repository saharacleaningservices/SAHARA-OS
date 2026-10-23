// MyBillBook invoice DETAIL read (owner 2026-10-23). Run: npm run test:mybillbook
// Synthetic invoices only (no real customer data). Throwaway SQLite DB; fetch is stubbed — no network, no login.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decideLinkByPhone, detailAgreesWithRow, embedRequest, extractInvoicePayload, linkIdOf, parseInvoiceDetail, parseStoredDetail, serviceLabel, toMobile10 } from "../src/lib/mybillbook-detail";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-mbbd-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let det: typeof import("../src/server/mybillbook-detail");
let imp: typeof import("../src/server/mybillbook-import");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  det = await import("../src/server/mybillbook-detail");
  imp = await import("../src/server/mybillbook-import");
});
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

// What the public invoice page ships: loadInvoice("<base64 of URL-encoded JSON>").
const page = (v: { no: string; date?: string; total: number; remaining?: number; name: string; mobile?: string; items: { name: string; qty?: number; rate: number }[]; notes?: string }) => {
  const payload = {
    party: { name: v.name, mobile_number: v.mobile ?? "" },
    voucher: {
      invoice_number: v.no,
      invoice_date: v.date ?? "2026-10-21",
      total_amount: String(v.total),
      remaining_amount: String(v.remaining ?? 0),
      discount: "0.0",
      payment_mode: "in_cash",
      customer_notes: v.notes ?? "",
      billing_address: { customer_name: v.name, street_address: "Salunke Vihar", city: "Pune", pincode: "" },
      items: v.items.map((i) => ({ name: i.name, quantity: String(i.qty ?? 1), price_per_unit: String(i.rate), item_final_amount: String((i.qty ?? 1) * i.rate), description: "" })),
    },
  };
  return `<html><body><script>\n loadInvoice(\n "${Buffer.from(encodeURIComponent(JSON.stringify(payload))).toString("base64")}",\n )</script></body></html>`;
};

test("pure: link id, request headers, payload round trip, parsing, label, agreement, phone rules", () => {
  assert.equal(linkIdOf("cpp/7qo8tmlxrw"), "7qo8tmlxrw");
  assert.equal(linkIdOf("i/116dkox"), "116dkox");
  assert.equal(linkIdOf("i/"), null);
  const r = embedRequest("abc1234");
  assert.equal(r.url, "https://mybillbook.in/api/i/cpp/embed/abc1234");
  assert.equal(r.headers.token, "abc1234"); // the link id is the whole key — no cookie, no login header
  assert.ok(!("Authorization" in r.headers) && !("Cookie" in r.headers));

  assert.equal(extractInvoicePayload("<html>Please use a web browser to view this page.</html>"), null);
  const d = parseInvoiceDetail(extractInvoicePayload(page({ no: "T/1", total: 17500, name: "Ms. Asha Rao", mobile: "+91 80870 78977", items: [{ name: "Full House Deep Cleaning", rate: 17500 }], notes: "Scope text" }))!)!;
  assert.deepEqual([d.invoiceNumber, d.invoiceDate, d.total, d.remaining, d.partyName, d.partyMobile, d.partyAddress], ["T/1", "2026-10-21", 17500, 0, "Ms. Asha Rao", "8087078977", "Salunke Vihar, Pune"]);
  assert.deepEqual(d.lines.map((l) => [l.name, l.qty, l.rate, l.amount]), [["Full House Deep Cleaning", 1, 17500, 17500]]);
  assert.equal(d.notes, "Scope text");
  assert.equal(serviceLabel([...d.lines, { ...d.lines[0], name: "Sofa Cleaning" }, { ...d.lines[0] }]), "Full House Deep Cleaning + Sofa Cleaning");
  assert.equal(toMobile10("12345"), null);
  assert.equal(toMobile10("0 98765 43210"), "9876543210");
  assert.equal(detailAgreesWithRow(d, { invoiceNo: "T/1", amount: 17500 }), true);
  assert.equal(detailAgreesWithRow(d, { invoiceNo: "T/2", amount: 17500 }), false);
  assert.equal(detailAgreesWithRow(d, { invoiceNo: "T/1", amount: 9000 }), false);
  assert.equal(parseStoredDetail("not json"), null);
  assert.equal(parseStoredDetail(JSON.stringify(d))?.invoiceNumber, "T/1");

  const un = { matchStatus: "UNMATCHED", matchMethod: null, customerId: null };
  assert.deepEqual(decideLinkByPhone(un, "c1"), { action: "attach", customerId: "c1" });
  assert.deepEqual(decideLinkByPhone(un, null), { action: "none" });
  assert.deepEqual(decideLinkByPhone({ matchStatus: "MANUAL", matchMethod: "MANUAL", customerId: "c9" }, "c1"), { action: "none" });
  assert.deepEqual(decideLinkByPhone({ matchStatus: "MATCHED", matchMethod: "INVOICE_NO", customerId: "c9" }, "c1"), { action: "none" });
  assert.deepEqual(decideLinkByPhone({ matchStatus: "MATCHED", matchMethod: "NAME", customerId: "c1" }, "c1"), { action: "none" });
  assert.deepEqual(decideLinkByPhone({ matchStatus: "MATCHED", matchMethod: "NAME", customerId: "c9" }, "c1"), { action: "review", candidateIds: ["c9", "c1"] });
});

const mk = (n: string, over: Record<string, unknown> = {}) =>
  db.mybillbookInvoice.create({ data: { invoiceNo: `T/${n}`, invoiceKey: `i/key${n}`, invoiceDate: new Date("2026-10-21T06:30:00Z"), contactName: `Name ${n}`, amount: 1000, status: "Paid", invoiceLink: `https://mybillbook.in/i/key${n}`, ...over } });

test("run: reads details, attaches by phone, protects manual / name-conflict, flags mismatch, 404 and transient errors, is re-runnable", async () => {
  const [a, b, c] = await Promise.all(
    [["Asha Rao", "9811111111"], ["Ravi Kumar", "9822222222"], ["Meera Joshi", "9833333333"]].map(([name, mobile]) => db.customer.create({ data: { name, mobile, customerNumber: `C-${mobile}` } })),
  );
  await mk("1"); // unmatched → phone attaches to Asha
  await mk("2", { customerId: c.id, matchStatus: "MANUAL", matchMethod: "MANUAL" }); // admin's choice: never moved
  await mk("3", { customerId: c.id, matchStatus: "MATCHED", matchMethod: "NAME" }); // name says Meera, phone says Ravi → review
  await mk("4"); // page shows another invoice → MISMATCH
  await mk("5"); // gone → FAILED
  await mk("6"); // unknown phone → stays unmatched, mobile kept
  const pages: Record<string, () => Response> = {
    key1: () => new Response(page({ no: "T/1", total: 1000, name: "Mrs Asha", mobile: a.mobile, items: [{ name: "Sofa Cleaning", qty: 5, rate: 200 }] })),
    key2: () => new Response(page({ no: "T/2", total: 1000, name: "X", mobile: a.mobile, items: [{ name: "Kitchen Cleaning", rate: 1000 }] })),
    key3: () => new Response(page({ no: "T/3", total: 1000, name: "X", mobile: b.mobile, items: [{ name: "Bathroom Cleaning", rate: 1000 }] })),
    key4: () => new Response(page({ no: "T/999", total: 1000, name: "X", mobile: a.mobile, items: [{ name: "Other", rate: 1000 }] })),
    key5: () => new Response("gone", { status: 404 }),
    key6: () => new Response(page({ no: "T/6", total: 1000, name: "Stranger", mobile: "9899999999", items: [{ name: "Pest Control", rate: 1000 }] })),
  };
  const seen: string[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    const id = String(url).split("/").pop()!;
    assert.equal((init?.headers as Record<string, string>).token, id);
    seen.push(id);
    return pages[id]();
  }) as unknown as typeof fetch;

  const r = det.startDetailFetch({ fetchImpl: fakeFetch, delayMs: 0 });
  assert.equal(r.started, true);
  assert.equal(det.startDetailFetch({ fetchImpl: fakeFetch, delayMs: 0 }).started, false, "a second start while running is refused");
  await r.finished;

  const row = (k: string) => db.mybillbookInvoice.findUniqueOrThrow({ where: { invoiceKey: `i/${k}` } });
  const r1 = await row("key1");
  assert.deepEqual([r1.detailStatus, r1.serviceName, r1.partyMobile, r1.customerId, r1.matchStatus, r1.matchMethod], ["DONE", "Sofa Cleaning", a.mobile, a.id, "MATCHED", "PHONE"]);
  assert.equal(JSON.parse(r1.detailJson!).lines[0].qty, 5);
  const r2 = await row("key2");
  assert.deepEqual([r2.detailStatus, r2.customerId, r2.matchStatus, r2.serviceName], ["DONE", c.id, "MANUAL", "Kitchen Cleaning"]);
  const r3 = await row("key3");
  assert.deepEqual([r3.matchStatus, r3.customerId], ["REVIEW", null]);
  assert.deepEqual(JSON.parse(r3.candidateIds!).sort(), [b.id, c.id].sort());
  const r4 = await row("key4");
  assert.deepEqual([r4.detailStatus, r4.customerId, r4.serviceName], ["MISMATCH", null, null]);
  assert.match(r4.detailError!, /T\/999/);
  const r5 = await row("key5");
  assert.deepEqual([r5.detailStatus, r5.detailError], ["FAILED", "MyBillBook no longer has this invoice link"]);
  const r6 = await row("key6");
  assert.deepEqual([r6.detailStatus, r6.customerId, r6.matchStatus, r6.partyMobile], ["DONE", null, "UNMATCHED", "9899999999"]);
  assert.equal(await db.mybillbookInvoice.count(), 6, "no duplicate rows");
  assert.deepEqual(await det.detailCounts(), { pending: 0, done: 4, failed: 1, mismatch: 1 });

  // Re-running reads nothing again (DONE / FAILED / MISMATCH are final); "retry failed" tries only the failed one.
  seen.length = 0;
  await det.startDetailFetch({ fetchImpl: fakeFetch, delayMs: 0 }).finished;
  assert.deepEqual(seen, []);
  await det.startDetailFetch({ fetchImpl: fakeFetch, delayMs: 0, retryFailed: true }).finished;
  assert.deepEqual(seen, ["key5"]);

  // A CSV re-import keeps the details and the phone-based attachment.
  const csv = `Invoice No,Invoice Date,Contact Name,Amount,Remaining Amount,Invoice Status,Due Date,Invoice Link,Payment Type,Created by\nT/1,21/10/2026,Name 1,1000,0,Paid,,https://mybillbook.in/i/key1,credit,Altaf\n`;
  await imp.importMybillbookCsv(csv, "b2");
  const again = await row("key1");
  assert.deepEqual([again.detailStatus, again.customerId, again.matchMethod, again.serviceName], ["DONE", a.id, "PHONE", "Sofa Cleaning"]);
  assert.equal(await db.mybillbookInvoice.count(), 6);
});

test("run: when MyBillBook keeps failing the run pauses by itself and leaves the rows PENDING (nothing lost, nothing marked failed)", async () => {
  await db.mybillbookInvoice.deleteMany({});
  for (let i = 0; i < 8; i++) await mk(`e${i}`);
  let calls = 0;
  const down = (async () => { calls++; return new Response("busy", { status: 503 }); }) as unknown as typeof fetch;
  const r = det.startDetailFetch({ fetchImpl: down, delayMs: 0, concurrency: 1 });
  await r.finished;
  assert.ok(calls >= 5 && calls < 8, `stopped after the 5th consecutive failure (calls=${calls})`);
  assert.match(det.detailRunState().stopReason ?? "", /Paused: MyBillBook is not answering/);
  assert.deepEqual(await det.detailCounts(), { pending: 8, done: 0, failed: 0, mismatch: 0 });

  // Network exceptions are treated the same way, and a later run starts clean and finishes.
  const ok = (async (url: string) => {
    const k = String(url).split("/").pop()!;
    const n = k.replace("key", "");
    return new Response(page({ no: `T/${n}`, total: 1000, name: "Z", mobile: "", items: [{ name: "Deep Cleaning", rate: 1000 }] }));
  }) as unknown as typeof fetch;
  await det.startDetailFetch({ fetchImpl: ok, delayMs: 0 }).finished;
  assert.deepEqual(await det.detailCounts(), { pending: 0, done: 8, failed: 0, mismatch: 0 });
  assert.equal(det.detailRunState().stopReason, null);
});
