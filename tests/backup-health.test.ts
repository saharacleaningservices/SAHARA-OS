// Stale-backup alert + delivery confirmation (2026-10-14). Run: npm run test:backup
// Fresh throwaway SQLite DB (scripts/db-setup.mjs) — never dev.db, no network, no WhatsApp/SMS.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-backup-health-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
process.env.BACKUP_TOKEN = "unit-test-token-not-real";
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let health: typeof import("../src/server/backup-health");
let confirm: typeof import("../src/app/api/backup/confirm/route");
let NextRequest: typeof import("next/server").NextRequest;

const H = 3_600_000;
// 12:00 IST on a fixed day (daytime → alerts allowed)
const NOON_IST = new Date("2026-10-14T06:30:00Z");
const at = (hoursAgo: number, from = NOON_IST) => new Date(from.getTime() - hoursAgo * H);
const event = (status: string, createdAt: Date, kind = "AUTO") => db.backupEvent.create({ data: { kind, status, createdAt, triggeredBy: "github-action" } });

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  health = await import("../src/server/backup-health");
  confirm = await import("../src/app/api/backup/confirm/route");
  NextRequest = (await import("next/server")).NextRequest;
  await db.user.create({ data: { name: "Altaf Shaikh", email: "altaf@t", role: "ADMIN" as never, passwordHash: "x" } });
  await db.user.create({ data: { name: "Shoyab Kazi", email: "shoyab@t", role: "ACCOUNTS" as never, passwordHash: "x" } });
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});
const reset = async () => {
  await db.backupEvent.deleteMany();
  await db.notification.deleteMany();
};

test("no backup ever recorded → NONE, and the owner is alerted (daytime)", async () => {
  await reset();
  assert.equal((await health.getBackupHealth(NOON_IST)).state, "NONE");
  assert.equal(await health.maybeBackupStaleAlert(NOON_IST), "alerted");
});

test("normal: backup delivered 10 h ago → OK, no alert", async () => {
  await reset();
  await event("DELIVERED", at(10));
  const h = await health.getBackupHealth(NOON_IST);
  assert.equal(h.state, "OK");
  assert.equal(h.source, "DELIVERED");
  assert.equal(await health.maybeBackupStaleAlert(NOON_IST), "ok");
  assert.equal(await db.notification.count({ where: { kind: "BACKUP_STALE" } }), 0);
});

test("boundary: 25.9 h is still OK, 26.1 h is STALE", async () => {
  await reset();
  await event("DELIVERED", at(25.9));
  assert.equal((await health.getBackupHealth(NOON_IST)).state, "OK");
  await reset();
  await event("DELIVERED", at(26.1));
  assert.equal((await health.getBackupHealth(NOON_IST)).state, "STALE");
});

test("overdue: last delivery 30 h ago → exactly one critical alert, Super Admin only", async () => {
  await reset();
  await event("DELIVERED", at(30));
  assert.equal(await health.maybeBackupStaleAlert(NOON_IST), "alerted");
  const rows = await db.notification.findMany({ where: { kind: "BACKUP_STALE" }, include: { user: true } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user.role, "ADMIN");
  assert.equal(rows[0].critical, true);
  assert.match(rows[0].body ?? "", /Last backup delivered to Google Drive/);
});

test("no spam: a second check within 24 h does not alert again; after 24 h it does", async () => {
  await reset();
  await event("DELIVERED", at(30));
  assert.equal(await health.maybeBackupStaleAlert(NOON_IST), "alerted");
  // notify() stamps the real clock; pin that alert to the simulated time so "25 h later" is meaningful.
  await db.notification.updateMany({ where: { kind: "BACKUP_STALE" }, data: { createdAt: NOON_IST } });
  assert.equal(await health.maybeBackupStaleAlert(new Date(NOON_IST.getTime() + 2 * H)), "recently-alerted");
  assert.equal(await health.maybeBackupStaleAlert(new Date(NOON_IST.getTime() + 25 * H)), "alerted");
  assert.equal(await db.notification.count({ where: { kind: "BACKUP_STALE" } }), 2);
});

test("night: an overdue backup waits for the morning (08:00–22:00 IST only)", async () => {
  await reset();
  const threeAmIst = new Date("2026-10-13T21:30:00Z");
  await event("DELIVERED", at(30, threeAmIst));
  assert.equal(await health.maybeBackupStaleAlert(threeAmIst), "night");
  assert.equal(await db.notification.count({ where: { kind: "BACKUP_STALE" } }), 0);
});

test("upload failure: snapshots keep being served (SUCCESS) but nothing is DELIVERED → STALE even though a snapshot is fresh", async () => {
  await reset();
  await event("DELIVERED", at(60));
  await event("SUCCESS", at(2)); // /api/backup served a snapshot, the Drive upload then failed → no confirmation
  const h = await health.getBackupHealth(NOON_IST);
  assert.equal(h.state, "STALE");
  assert.equal(await health.maybeBackupStaleAlert(NOON_IST), "alerted");
});

test("rollout window: before the first confirmation ever, a fresh automatic snapshot counts (LEGACY_SNAPSHOT); manual and FAILED do not", async () => {
  await reset();
  await event("SUCCESS", at(3), "AUTO");
  const h = await health.getBackupHealth(NOON_IST);
  assert.deepEqual([h.state, h.source], ["OK", "LEGACY_SNAPSHOT"]);
  await reset();
  await event("SUCCESS", at(3), "MANUAL");
  await event("FAILED", at(1));
  assert.equal((await health.getBackupHealth(NOON_IST)).state, "NONE");
});

test("recovery: a new DELIVERED confirmation clears the overdue state", async () => {
  await reset();
  await event("DELIVERED", at(40));
  assert.equal((await health.getBackupHealth(NOON_IST)).state, "STALE");
  await event("DELIVERED", at(1));
  assert.equal((await health.getBackupHealth(NOON_IST)).state, "OK");
});

const post = (body: unknown, auth?: string) =>
  confirm.POST(new NextRequest("http://localhost/api/backup/confirm", { method: "POST", headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) }));

test("confirm endpoint: needs the bearer token, validates input, records DELIVERED", async () => {
  await reset();
  const good = { fileName: "sahara-os-20261014-140625.tar.gz", sizeBytes: 5281507, destination: "google-drive" };
  assert.equal((await post(good)).status, 401, "no token");
  assert.equal((await post(good, "Bearer wrong")).status, 401, "wrong token");
  const auth = `Bearer ${process.env.BACKUP_TOKEN}`;
  assert.equal((await post({ ...good, fileName: "../../etc/passwd" }, auth)).status, 400, "path-like file name");
  assert.equal((await post({ ...good, sizeBytes: -5 }, auth)).status, 400, "bad size");
  assert.equal((await post({ ...good, sizeBytes: "5281507" }, auth)).status, 400, "size must be a number");
  assert.equal(await db.backupEvent.count(), 0, "rejected calls record nothing");
  assert.equal((await post(good, auth)).status, 200);
  const ev = (await db.backupEvent.findFirst())!;
  assert.equal(ev.status, "DELIVERED");
  assert.equal(ev.fileName, good.fileName);
  assert.equal(ev.sizeBytes, good.sizeBytes);
  assert.equal((await health.getBackupHealth(new Date())).state, "OK");
});
