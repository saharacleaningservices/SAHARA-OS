// SQLite job queue + masked crew card (owner 2026-10-22). Run: npm run test:queue
// Throwaway SQLite DB (scripts/db-setup.mjs); no network, no WhatsApp credentials (messages are only logged in TEST mode).
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-queue-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.AUTH_SECRET = "test-secret-for-crew-card-tokens-0123456789";
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_USE_TEMPLATES", "WHATSAPP_COMPLETED_TEMPLATE", "WHATSAPP_OUTBOUND_MODE"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let q: typeof import("../src/server/job-queue");
let handlers: typeof import("../src/server/job-queue-handlers");
let card: typeof import("../src/server/crew-card");
let tok: typeof import("../src/lib/crew-card-token");
let n = 0;
const PHONE = "9876501234";
const makeJob = () =>
  db.job.create({
    data: { jobNumber: `Q-JOB-${++n}`, customerName: "Asha", customerMobile: PHONE, address: "Flat 2, Kharadi", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(Date.now() + 86_400_000), scheduledTime: "10:00 AM", jobValue: 7777, status: "ASSIGNED", notes: "Use side gate", scopeOfWork: "Kitchen deep clean\nBathroom scrub" } as never,
  });

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  q = await import("../src/server/job-queue");
  handlers = await import("../src/server/job-queue-handlers");
  card = await import("../src/server/crew-card");
  tok = await import("../src/lib/crew-card-token");
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});

test("queue: a job runs once; the same dedupe key is not queued twice while unfinished", async () => {
  const a = await q.enqueueJob("TEAM_DISPATCH", { jobId: "x" }, { dedupeKey: "k1" });
  const b = await q.enqueueJob("TEAM_DISPATCH", { jobId: "x" }, { dedupeKey: "k1" });
  assert.equal(a.queued, true);
  assert.equal(b.queued, false);
  let ran = 0;
  const r = await q.runDueJobs({ TEAM_DISPATCH: async () => { ran += 1; } });
  assert.deepEqual([r.done, r.failed, ran], [1, 0, 1]);
  assert.equal((await q.runDueJobs({ TEAM_DISPATCH: async () => { ran += 1; } })).done, 0, "already DONE");
  assert.equal((await q.enqueueJob("TEAM_DISPATCH", { jobId: "x" }, { dedupeKey: "k1" })).queued, true, "a finished job frees its key");
});

test("queue: two sweeps at the same moment run a job once (atomic claim)", async () => {
  await q.enqueueJob("TEAM_DISPATCH", { jobId: "y" }, { dedupeKey: "k2" });
  let ran = 0;
  const h = { TEAM_DISPATCH: async () => { await new Promise((r) => setTimeout(r, 30)); ran += 1; } };
  await Promise.all([q.runDueJobs(h), q.runDueJobs(h), q.runDueJobs(h)]);
  assert.equal(ran, 2, "k1's fresh job + k2 — each exactly once");
});

test("queue: a failing job is retried later with back-off, then parked as FAILED with the reason", async () => {
  const { id } = await q.enqueueJob("JOB_COMPLETED_NOTICE", { jobId: "z" });
  const boom = { JOB_COMPLETED_NOTICE: async () => { throw new Error("Meta unreachable"); } };
  for (let i = 1; i <= q.MAX_ATTEMPTS; i++) {
    await db.outboxJob.update({ where: { id: id! }, data: { runAt: new Date(Date.now() - 1000) } }); // fast-forward the back-off
    await q.runDueJobs(boom);
    const row = (await db.outboxJob.findUnique({ where: { id: id! } }))!;
    assert.equal(row.attempts, i);
    assert.equal(row.status, i < q.MAX_ATTEMPTS ? "PENDING" : "FAILED");
    if (i < q.MAX_ATTEMPTS) assert.ok(row.runAt.getTime() > Date.now(), "scheduled in the future");
  }
  assert.equal((await db.outboxJob.findUnique({ where: { id: id! } }))!.lastError, "Meta unreachable");
});

test("queue: a job left RUNNING by a dead process is picked up again", async () => {
  const { id } = await q.enqueueJob("TEAM_DISPATCH", { jobId: "w" });
  await db.outboxJob.update({ where: { id: id! }, data: { status: "RUNNING", lockedAt: new Date(Date.now() - 11 * 60_000), attempts: 1 } });
  let ran = 0;
  await q.runDueJobs({ TEAM_DISPATCH: async () => { ran += 1; } });
  assert.equal(ran, 1);
});

test("crew card token: genuine links verify; tampered, forged or other-job tokens do not", async () => {
  const job = await makeJob();
  const t = tok.crewCardToken(job.id);
  assert.equal(tok.verifyCrewCardToken(t), job.id);
  assert.equal(tok.verifyCrewCardToken(`${job.id}.AAAAAAAAAAAAAAAAAAAAAAAA`), null);
  assert.equal(tok.verifyCrewCardToken(`someone-else.${t.split(".")[1]}`), null);
  assert.equal(tok.verifyCrewCardToken("nonsense"), null);
});

test("crew card carries ONLY job ID, service, package, date/slot, site address and team — no phone, amount, notes or scope", async () => {
  const job = await makeJob();
  await db.job.update({ where: { id: job.id }, data: { packageName: "Platinum", serviceVariant: "3 BHK", teamNumber: 2 } });
  const c = (await card.getCrewCard(job.id))!;
  const json = JSON.stringify(c);
  assert.ok(!json.includes(PHONE) && !json.includes("7777") && !/jobValue|mobile|amount/i.test(json), "no phone, no amount");
  assert.ok(!json.includes("Use side gate") && !json.includes("Kitchen deep clean"), "no internal notes or scope text");
  assert.deepEqual(Object.keys(c).sort(), ["address", "area", "crew", "date", "jobNumber", "mapLink", "packageLabel", "service", "supervisor", "team", "timeSlot"]);
  assert.deepEqual([c.jobNumber, c.packageLabel, c.team, c.timeSlot], [job.jobNumber, "3 BHK — Platinum", "Team 2", "10:00 AM"]);
  const text = card.crewGroupMessage(c, "https://crm.example/crew-card/x.y");
  assert.ok(text.includes(job.jobNumber) && text.includes("3 BHK — Platinum") && text.includes("Kharadi") && text.includes("10:00 AM"));
  assert.ok(!text.includes(PHONE) && !/₹|7777/.test(text), "group text: no phone, no amount");
});

test("crew dispatch message (the one sent to each crew member) links the card and hides phone and amount", async () => {
  const job = await makeJob();
  const staff = await db.staff.create({ data: { employeeCode: `T-${job.id.slice(-4)}`, name: "Ravi", mobile: "9000000321", designation: "Cleaner", dailyWage: 700, salaryType: "DAILY" } as never });
  await db.jobAssignment.create({ data: { jobId: job.id, staffId: staff.id } as never });
  const r = await handlers.runQueueSweep(); // nothing queued yet
  assert.equal(r.done, 0);
  await handlers.enqueueTeamDispatch(job.id);
  assert.equal((await handlers.enqueueTeamDispatch(job.id)).queued, false, "one unfinished dispatch per job");
  const s = await handlers.runQueueSweep();
  assert.equal(s.done, 1);
  const msg = await db.whatsAppMessage.findFirst({ where: { kind: "TEAM_DISPATCH", relatedId: job.id } });
  assert.ok(msg, "the crew message was logged");
  assert.ok(msg!.body.includes(`/crew-card/${tok.crewCardToken(job.id)}`), "card link included");
  assert.ok(!msg!.body.includes(PHONE) && !msg!.body.includes("7777") && !/₹/.test(msg!.body), "phone and amount hidden");
});

test("job completion: ONE message with ONE View Invoice link and no separate pay link; TEST mode keeps it from a real customer; kill-switch works", async () => {
  const job = await makeJob();
  await db.job.update({ where: { id: job.id }, data: { status: "COMPLETED" } });
  await db.invoice.create({ data: { invoiceNumber: `INV-Q-${job.id.slice(-5)}`, jobId: job.id, customerName: "Asha", lineItems: "[]", subTotal: 7777, totalAmount: 7777 } as never });
  process.env.WHATSAPP_DOC_LINKS = "off";
  await handlers.sendJobCompletedNotice(job.id);
  assert.equal(await db.whatsAppMessage.count({ where: { kind: "JOB_COMPLETED", relatedId: job.id } }), 0, "kill-switch off -> nothing");
  delete process.env.WHATSAPP_DOC_LINKS;
  await handlers.sendJobCompletedNotice(job.id);
  await handlers.sendJobCompletedNotice(job.id); // repeat is skipped
  const msgs = await db.whatsAppMessage.findMany({ where: { kind: "JOB_COMPLETED", relatedId: job.id } });
  assert.equal(msgs.length, 1);
  const token = (await db.job.findUnique({ where: { id: job.id } }))!.publicToken!;
  assert.ok(msgs[0].body.includes(`/booking/invoice/${token}`) && !msgs[0].body.includes("/booking/pay/") && msgs[0].body.includes("INV-Q-"));
  assert.equal((msgs[0].body.match(/\/booking\//g) ?? []).length, 1, "exactly one booking link in the message");
  assert.notEqual(msgs[0].status, "SENT", "TEST mode: a real customer number is never messaged");
});

test("quotation created: ONE estimate message with the secure link, once per quotation", async () => {
  const lead = await db.lead.create({ data: { leadNumber: `LD-Q-${++n}`, name: "Bina", mobile: "9876500011", area: "Baner", service: "HOME_DEEP_CLEANING", source: "WEBSITE" } as never });
  const quote = await db.quotation.create({ data: { quoteNumber: `QT-Q-${n}`, leadId: lead.id, services: "[]", subTotal: 5000, totalAmount: 5000, terms: "t" } as never });
  assert.equal((await handlers.enqueueQuotationNotice(quote.id)).queued, true);
  assert.equal((await handlers.enqueueQuotationNotice(quote.id)).queued, false, "one unfinished notice per quotation");
  await handlers.runQueueSweep();
  await handlers.sendQuotationNotice(quote.id); // a second send is skipped
  const msgs = await db.whatsAppMessage.findMany({ where: { kind: "QUOTATION_NOTICE", relatedId: quote.id } });
  assert.equal(msgs.length, 1);
  const token = (await db.quotation.findUnique({ where: { id: quote.id } }))!.publicToken!;
  assert.ok(token && msgs[0].body.includes(`/booking?quote=${token}`) && msgs[0].body.includes(`QT-Q-${n}`));
  assert.notEqual(msgs[0].status, "SENT");
});

test("work started: no message while the template is off; with it on, ONE template send to the QA number only, once per job", async () => {
  const keep = { ...process.env };
  const realFetch = globalThis.fetch;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  try {
    const job = await makeJob();
    await db.job.update({ where: { id: job.id }, data: { status: "STARTED", customerMobile: "9800817070" } });
    await handlers.sendServiceStartedNotice(job.id);
    assert.equal(await db.whatsAppMessage.count({ where: { kind: "SERVICE_STARTED", relatedId: job.id } }), 0, "off by default");
    Object.assign(process.env, { WHATSAPP_USE_TEMPLATES: "on", WHATSAPP_STARTED_TEMPLATE: "v1", WHATSAPP_ACCESS_TOKEN: "test-token-not-real", WHATSAPP_PHONE_NUMBER_ID: "000000000000000" });
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => { calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) }); return new Response(JSON.stringify({ messages: [{ id: "wamid.S1" }] }), { status: 200 }); }) as typeof fetch;
    await handlers.sendServiceStartedNotice(job.id);
    await handlers.sendServiceStartedNotice(job.id);
    const sends = calls.filter((c) => /\/messages$/.test(c.url));
    assert.equal(sends.length, 1, "exactly one send");
    const tpl = sends[0].body.template as { name: string; components: { type: string; parameters: { text: string }[] }[] };
    assert.equal(tpl.name, "sahara_service_started_v1");
    assert.deepEqual(tpl.components.find((c) => c.type === "body")!.parameters.map((x) => x.text), ["Asha", "Home Deep Cleaning", job.jobNumber]);
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k];
    Object.assign(process.env, keep);
  }
});

test("work started is queued from the status change; work completed text carries thanks + ONE invoice link + ONE Google review link (no pay link)", async () => {
  const src = (await import("node:fs")).readFileSync("src/server/actions/jobs.ts", "utf8");
  assert.match(src, /status === "STARTED"\) void enqueueServiceStartedNotice\(jobId\)/);
  await db.companySettings.upsert({ where: { id: "default" }, update: { googleReviewUrl: "https://g.page/r/TEST/review" }, create: { id: "default", name: "Sahara", phone: "0", email: "t@t", address: "x", googleReviewUrl: "https://g.page/r/TEST/review" } as never });
  const job = await makeJob();
  await db.job.update({ where: { id: job.id }, data: { status: "COMPLETED" } });
  await handlers.sendJobCompletedLinks(job.id, { force: true });
  const m = await db.whatsAppMessage.findFirst({ where: { kind: "JOB_COMPLETED", relatedId: job.id } });
  assert.ok(m && /Thank you/.test(m.body) && m.body.includes("/booking/invoice/") && !m.body.includes("/booking/pay/") && m.body.includes("https://g.page/r/TEST/review"));
  assert.equal((m.body.match(/https?:\/\//g) ?? []).length, 2, "exactly two links: invoice + Google review");
});

test("housekeeping: only finished queue rows older than 30 days are removed; pending, running and parked-failed rows stay; the removal is audit-logged", async () => {
  const q2 = await import("../src/server/job-queue");
  const old = new Date(Date.now() - 45 * 86_400_000);
  const mk = async (status: string, updatedAt: Date) => {
    const r = await db.outboxJob.create({ data: { kind: "TEAM_DISPATCH", payload: "{}", status } });
    await db.$executeRaw`UPDATE "OutboxJob" SET "updatedAt" = ${updatedAt.toISOString()} WHERE "id" = ${r.id}`;
    return r.id;
  };
  const oldDone = await mk("DONE", old);
  const freshDone = await mk("DONE", new Date());
  const oldFailed = await mk("FAILED", old);
  const oldPending = await mk("PENDING", old);
  const removed = await q2.pruneFinishedJobs(30);
  assert.equal(removed, 1);
  const left = (await db.outboxJob.findMany({ where: { id: { in: [oldDone, freshDone, oldFailed, oldPending] } }, select: { id: true } })).map((r) => r.id).sort();
  assert.deepEqual(left, [freshDone, oldFailed, oldPending].sort());
  assert.equal(await db.auditLog.count({ where: { entityId: "outbox-prune", action: "PRUNE" } }), 1);
  assert.equal(await q2.pruneFinishedJobs(30), 0, "nothing left to remove");
});
