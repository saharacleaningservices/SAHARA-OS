// Sahara OS Helper app backend (2026-10-26): call metadata, back-fill rules, recording upload route, festive post-call template.
// Run: npm run test:callhelper — routes run against a throwaway SQLite DB and a temp uploads folder; no network, no WhatsApp credentials.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { BACKFILL_AFTER_MIN, callMetaFrom, planAutoReply, recordingUploadsOpen } from "../src/lib/call-autoresponder";
import { templateByName } from "../src/lib/whatsapp-cloud-templates";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-callhelper-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.UPLOADS_DIR = path.join(dir, "uploads");
process.env.CALL_TRIGGER_TOKEN = "t".repeat(32);
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "CALL_AUTOREPLY", "FESTIVAL_FULL_UNTIL", "CALL_RECORDING_UPLOADS_UNTIL"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  return realLoad.call(this, request, parent, isMain);
};

let db: typeof import("../src/lib/db").db;
let trigger: typeof import("../src/app/api/v1/webhooks/call-trigger/route");
let recording: typeof import("../src/app/api/v1/webhooks/call-recording/route");
const AUTH = { authorization: `Bearer ${"t".repeat(32)}` };
const NOW = new Date();
const iso = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString();
const callPost = (body: Record<string, unknown>, headers: Record<string, string> = AUTH) =>
  trigger.POST(new NextRequest("http://localhost/api/v1/webhooks/call-trigger", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }));
const recPost = (fields: Record<string, string>, file: File | null = new File([new Uint8Array(2048)], "Call recording.m4a", { type: "audio/mp4" }), headers: Record<string, string> = AUTH) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  if (file) f.set("file", file);
  return recording.POST(new NextRequest("http://localhost/api/v1/webhooks/call-recording", { method: "POST", headers, body: f }));
};

test("setup", async () => {
  ({ db } = await import("../src/lib/db"));
  trigger = await import("../src/app/api/v1/webhooks/call-trigger/route");
  recording = await import("../src/app/api/v1/webhooks/call-recording/route");
  assert.ok(db);
});

test("call metadata: id is sanitised, direction + phone label read, history = flagged or older than 30 minutes", () => {
  assert.equal(BACKFILL_AFTER_MIN, 30);
  const fresh = callMetaFrom({ externalId: "Francis:1790000000000:9000000001", endedAt: iso(60_000), direction: "incoming", deviceLabel: "Francis" }, NOW);
  assert.deepEqual([fresh.externalId, fresh.backfill, fresh.direction, fresh.deviceLabel], ["Francis:1790000000000:9000000001", false, "INCOMING", "Francis"]);
  assert.equal(callMetaFrom({ externalId: "bad id; drop table" }, NOW).externalId, null);
  assert.equal(callMetaFrom({ endedAt: iso(31 * 60_000) }, NOW).backfill, true);
  assert.equal(callMetaFrom({ endedAt: String(NOW.getTime() - 3_600_000) }, NOW).backfill, true, "epoch milliseconds");
  assert.equal(callMetaFrom({ historical: "true" }, NOW).backfill, true);
  assert.equal(callMetaFrom({ direction: "OUTGOING" }, NOW).direction, "OUTGOING");
  assert.equal(callMetaFrom({ deviceLabel: "Shoaib<script>" }, NOW).deviceLabel, "Shoaibscript");
  assert.equal(callMetaFrom({}, NOW).backfill, false);
});

test("recording uploads: open when unset, closed the day after CALL_RECORDING_UPLOADS_UNTIL (IST)", () => {
  assert.equal(recordingUploadsOpen(undefined, NOW), true);
  assert.equal(recordingUploadsOpen("not-a-date", NOW), true);
  assert.equal(recordingUploadsOpen("2026-11-25", new Date("2026-11-25T17:00:00Z")), true, "25 Nov 22:30 IST is still the 25th");
  assert.equal(recordingUploadsOpen("2026-11-25", new Date("2026-11-25T19:00:00Z")), false, "26 Nov 00:30 IST");
});

test("festive post-call message: slots full till 3 Nov, bookings from 4 Nov, booking host link, Google 4.9★, website, Instagram", () => {
  const during = planAutoReply({ event: "ANSWERED", caller: "9876543210", now: new Date("2026-11-03T05:00:00Z"), festivalFullUntil: "2026-11-03" })!;
  assert.equal(during.template, "festival_booking_full_notice");
  assert.deepEqual(during.bodyParams, ["3 Nov 2026", "4 Nov 2026"]);
  assert.equal(planAutoReply({ event: "MISSED", caller: "9876543210", now: new Date("2026-11-03T05:00:00Z"), festivalFullUntil: "2026-11-03" })!.template, "festival_booking_full_notice", "answered AND missed callers");
  assert.equal(planAutoReply({ event: "ANSWERED", caller: "9876543210", now: new Date("2026-11-04T05:00:00Z"), festivalFullUntil: "2026-11-03" }), null, "switches itself off after 3 Nov");
  assert.ok(during.sms.includes("https://booking.saharacleaningservices.com/booking"));
  const t = templateByName("festival_booking_full_notice")!;
  for (const needle of ["https://booking.saharacleaningservices.com/booking", "4.9★", "www.saharacleaningservices.com", "instagram.com/saharacleaningservices.pune", "{{1}}", "{{2}}"]) assert.ok(t.body.includes(needle), needle);
  assert.ok(t.body.length <= 1024);
  assert.equal(t.buttons!.filter((b) => b.type === "URL").length, 2, "Book Now + Google Reviews");
  assert.ok(t.buttons!.some((b) => b.type === "URL" && b.text === "Google Reviews"));
  assert.ok(t.buttons!.some((b) => b.type === "URL" && b.text === "Book Now" && b.url === "https://booking.saharacleaningservices.com/booking"));
});

test("call-trigger: token required; a fresh missed call creates ONE lead; the same call twice is noted once", async () => {
  assert.equal((await callPost({ caller: "9000000101", status: "missed" }, {})).status, 401);
  const r1 = await (await callPost({ caller: "9000000101", status: "missed", endedAt: iso(60_000), externalId: "Owner:1:9000000101", deviceLabel: "Owner" })).json();
  assert.equal(r1.leadCreated, true);
  const lead = await db.lead.findFirstOrThrow({ where: { mobile: "9000000101" } });
  const r2 = await (await callPost({ caller: "9000000101", status: "missed", endedAt: iso(60_000), externalId: "Owner:1:9000000101", deviceLabel: "Owner" })).json();
  assert.equal(r2.leadCreated, false);
  const entries = await db.timelineEntry.findMany({ where: { leadId: lead.id, type: "CALL" } });
  assert.equal(entries.length, 1, "no duplicate timeline entry for the same externalId");
  assert.equal(await db.lead.count({ where: { mobile: "9000000101" } }), 1);
});

test("call-trigger back-fill + outgoing: logged on an existing lead only — never a new lead, never an auto-reply", async () => {
  const old = await (await callPost({ caller: "9000000102", status: "missed", endedAt: iso(2 * 86_400_000), externalId: "Owner:2:9000000102" })).json();
  assert.deepEqual([old.leadCreated, old.logged, old.autoReply], [false, "backfill", "none"]);
  assert.equal(await db.lead.count({ where: { mobile: "9000000102" } }), 0, "history never creates a lead");
  const out = await (await callPost({ caller: "9000000101", status: "answered", duration: 95, direction: "OUTGOING", endedAt: iso(10_000), externalId: "Owner:3:9000000101", deviceLabel: "Owner" })).json();
  assert.deepEqual([out.logged, out.autoReply], ["outgoing", "none"]);
  const lead = await db.lead.findFirstOrThrow({ where: { mobile: "9000000101" } });
  const note = await db.timelineEntry.findFirstOrThrow({ where: { leadId: lead.id, meta: { contains: "Owner:3:9000000101" } } });
  assert.match(note.body ?? "", /1m 35s · Owner/);
});

test("call-recording: 401 without token; closed after the expiry date; stores only for an existing lead, once, in the private folder", async () => {
  assert.equal((await recPost({ caller: "9000000101", externalId: "Owner:9:9000000101" }, undefined, {})).status, 401);
  process.env.CALL_RECORDING_UPLOADS_UNTIL = "2020-01-01";
  assert.equal((await recPost({ caller: "9000000101", externalId: "Owner:9:9000000101" })).status, 403);
  delete process.env.CALL_RECORDING_UPLOADS_UNTIL;

  const none = await recPost({ caller: "9000000103", externalId: "Owner:4:9000000103" });
  assert.equal(none.status, 202);
  assert.equal((await none.json()).reason, "no_lead");
  assert.equal(existsSync(path.join(process.env.UPLOADS_DIR!, "call-recordings")), false, "nothing unattached is kept");

  assert.equal((await recPost({ caller: "7083347130", externalId: "Owner:5:7083347130" })).status, 200, "owner number: accepted but not stored");
  assert.equal(existsSync(path.join(process.env.UPLOADS_DIR!, "call-recordings")), false);

  const ok = await recPost({ caller: "9000000101", externalId: "Francis:6:9000000101", durationSec: "134", deviceLabel: "Francis" });
  assert.deepEqual(await ok.json(), { ok: true, stored: true, lead: (await db.lead.findFirstOrThrow({ where: { mobile: "9000000101" } })).leadNumber });
  const files = readdirSync(path.join(process.env.UPLOADS_DIR!, "call-recordings"));
  assert.equal(files.length, 1);
  assert.match(files[0], /^[0-9a-f]{24}\.m4a$/);
  const entry = await db.timelineEntry.findFirstOrThrow({ where: { type: "CALL", audioUrl: { not: null } } });
  assert.equal(entry.audioUrl, `/uploads/call-recordings/${files[0]}`);
  assert.match(entry.body ?? "", /Call recording · 2m 14s · Francis/);

  const again = await (await recPost({ caller: "9000000101", externalId: "Francis:6:9000000101" })).json();
  assert.equal(again.reason, "duplicate");
  assert.equal(readdirSync(path.join(process.env.UPLOADS_DIR!, "call-recordings")).length, 1);
});

test("call-recording pre-check: the app asks first and uploads only when the server will keep the audio", async () => {
  const ask = async (fields: Record<string, string>) => (await recPost({ ...fields, check: "1" }, null)).json();
  assert.equal((await ask({ caller: "9000000104", externalId: "Owner:7:9000000104" })).reason, "no_lead");
  assert.equal((await ask({ caller: "7083347130", externalId: "Owner:7:7083347130" })).reason, "internal_number");
  assert.equal((await ask({ caller: "9000000101", externalId: "Francis:6:9000000101" })).reason, "duplicate", "already stored");
  const fresh = await ask({ caller: "9000000101", externalId: "Francis:8:9000000101" });
  assert.deepEqual([fresh.wantsUpload, typeof fresh.lead], [true, "string"]);
  process.env.CALL_RECORDING_UPLOADS_UNTIL = "2020-01-01";
  assert.equal((await recPost({ caller: "9000000101", check: "1" }, null)).status, 403);
  delete process.env.CALL_RECORDING_UPLOADS_UNTIL;
});

test("call-recording: bad type 415, missing file 400, bad caller 400; the folder is office-only", async () => {
  assert.equal((await recPost({ caller: "9000000101" }, new File(["x"], "evil.exe", { type: "application/octet-stream" }))).status, 415);
  assert.equal((await recPost({ caller: "9000000101" }, null)).status, 400);
  assert.equal((await recPost({ caller: "123" })).status, 400);
  assert.match(await (await import("node:fs/promises")).readFile("src/app/uploads/[...path]/route.ts", "utf8"), /"call-recordings": OFFICE/);
});

test.after(async () => {
  await db.$disconnect();
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ }
});
