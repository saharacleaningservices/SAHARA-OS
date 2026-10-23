// Work-completed message (one invoice link + one Google review link, template v2) and the three completion touchpoints (autonomous brief P1).
// Run: npx tsx --test tests/completion-touchpoints.test.ts   Synthetic data; throwaway DB; Meta is a stub.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-ct-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_OUTBOUND_MODE", "WHATSAPP_USE_TEMPLATES", "WHATSAPP_COMPLETED_TEMPLATE"]) delete process.env[k];

type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  return realLoad.call(this, request, parent, isMain);
};
let db: typeof import("../src/lib/db").db;
let act: typeof import("../src/server/actions/jobs");
let handlers: typeof import("../src/server/job-queue-handlers");
const realFetch = globalThis.fetch;
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  act = await import("../src/server/actions/jobs");
  handlers = await import("../src/server/job-queue-handlers");
});
test.after(async () => { globalThis.fetch = realFetch; M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

test("template v2: exactly one invoice URL button and one Google review button, no pay link, submittable, allowed in transactional mode", async () => {
  // Imported here, after DATABASE_URL points at the throwaway DB (these modules load the database client).
  const { templateByName } = await import("../src/lib/whatsapp-cloud-templates");
  const { buildMetaTemplatePayload, SUBMITTABLE_TEMPLATES } = await import("../src/lib/meta-template-payload");
  const { WHATSAPP_TRANSACTIONAL_TEMPLATES } = await import("../src/lib/whatsapp");
  const t = templateByName("sahara_job_completed_v2")!;
  assert.equal(t.category, "UTILITY");
  assert.deepEqual((t.buttons ?? []).map((b) => b.text), ["View Invoice", "Rate Us on Google"]);
  const urls = (t.buttons ?? []).flatMap((b) => ("url" in b ? [b.url] : []));
  assert.equal(urls.length, 2);
  assert.ok(urls[0].endsWith("/booking/invoice/{{1}}") && /g\.page|google/i.test(urls[1]));
  assert.ok(!JSON.stringify(t).includes("/booking/pay/"));
  assert.ok((SUBMITTABLE_TEMPLATES as readonly string[]).includes("sahara_job_completed_v2"));
  assert.ok(WHATSAPP_TRANSACTIONAL_TEMPLATES.includes("sahara_job_completed_v2"));
  assert.ok(buildMetaTemplatePayload(t));
});

const mkJob = async (status: string, token: string, extra: Record<string, unknown> = {}) =>
  db.job.create({ data: { jobNumber: `CT-${token.slice(0, 6)}`, customerName: "Asha", customerMobile: "9800817070", address: "Flat 2", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 5000, status, publicToken: token, ...extra } as never });

test("customer touchpoint: only a STARTED job can be confirmed; it completes once, makes one invoice, logs it, and bad tokens are refused", async () => {
  const tok = "A".repeat(24);
  const job = await mkJob("ASSIGNED", tok);
  assert.equal((await act.customerConfirmWorkCompleted("short")).success, false);
  assert.equal((await act.customerConfirmWorkCompleted("B".repeat(24))).success, false, "unknown booking");
  assert.equal((await act.customerConfirmWorkCompleted(tok)).success, false, "cannot complete before the team has started");
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status, "ASSIGNED");

  await db.job.update({ where: { id: job.id }, data: { status: "STARTED", startedAt: new Date() } });
  assert.equal((await act.customerConfirmWorkCompleted(tok)).success, true);
  const done = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(done.status, "COMPLETED");
  assert.ok(done.completedAt);
  assert.equal(await db.invoice.count({ where: { jobId: job.id } }), 1);
  assert.equal((await act.customerConfirmWorkCompleted(tok)).success, true, "a second tap is harmless");
  assert.equal(await db.invoice.count({ where: { jobId: job.id } }), 1);
  const log = (await db.activityLog.findMany({ where: { jobId: job.id } })).map((l) => l.action);
  assert.equal(log.filter((l) => /Customer confirmed work completed/.test(l)).length, 1);
  assert.equal(log.filter((l) => /Status changed to COMPLETED/.test(l)).length, 1);

  const demo = await mkJob("STARTED", "C".repeat(24), { jobNumber: "CT-DEMO", isDemo: true });
  assert.equal((await act.customerConfirmWorkCompleted("C".repeat(24))).success, false, "demo jobs are never completed from the public page");
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: demo.id } })).status, "STARTED");
});

test("v2 send: with the template switched on, ONE send with the invoice token on button 0, no pay link, to the QA number only", async () => {
  const keep = { ...process.env };
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  try {
    const job = await mkJob("COMPLETED", "D".repeat(24), { jobNumber: "CT-V2" });
    Object.assign(process.env, { WHATSAPP_USE_TEMPLATES: "on", WHATSAPP_COMPLETED_TEMPLATE: "v2", WHATSAPP_ACCESS_TOKEN: "test-token-not-real", WHATSAPP_PHONE_NUMBER_ID: "000000000000000" });
    globalThis.fetch = (async (url: string | URL, init?: RequestInit) => { calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) }); return new Response(JSON.stringify({ messages: [{ id: "wamid.C1" }] }), { status: 200 }); }) as typeof fetch;
    await handlers.sendJobCompletedNotice(job.id);
    await handlers.sendJobCompletedNotice(job.id);
    const sends = calls.filter((c) => /\/messages$/.test(c.url));
    assert.equal(sends.length, 1);
    const tpl = sends[0].body.template as { name: string; components: { type: string; index?: string; parameters: { text: string }[] }[] };
    assert.equal(tpl.name, "sahara_job_completed_v2");
    const btn = tpl.components.find((c) => c.type === "button" && c.index === "0")!;
    assert.equal(btn.parameters[0].text, "D".repeat(24));
    assert.ok(!JSON.stringify(sends[0].body).includes("/booking/pay/"));
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k];
    Object.assign(process.env, keep);
  }
});

test("all three touchpoints exist: Staff App buttons, CRM status actions, customer booking page", () => {
  assert.match(readFileSync("src/components/staff-app/job-status-buttons.tsx", "utf8"), /staffUpdateJobStatus/);
  assert.match(readFileSync("src/components/jobs/status-actions.tsx", "utf8"), /COMPLETED/);
  assert.match(readFileSync("src/components/public/booking-page-view.tsx", "utf8"), /job\.status === "STARTED" && <ConfirmCompletedButton/);
});
