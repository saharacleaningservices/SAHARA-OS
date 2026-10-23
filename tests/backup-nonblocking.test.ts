// The backup must not freeze the server (owner alert 2026-10-23: "event loop blocked 17991 ms"). Run: npm run test:backupasync
// Builds a real ~60 MB SQLite database and a ~120 MB uploads folder, runs the backup building blocks, and watches a 20 ms timer:
// while the backup works, the loop must keep ticking. The same work done synchronously (the old code) is measured for contrast.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { runTar, snapshotDatabase } from "../src/lib/backup-async";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-backup-"));
const dbFile = path.join(dir, "live.db");
const uploads = path.join(dir, "uploads");
test.after(() => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

/** Max gap between two ticks of a 20 ms timer while `work` runs, in ms. */
async function worstLoopStall<T>(work: () => Promise<T> | T): Promise<{ stall: number; result: T }> {
  let last = Date.now();
  let stall = 0;
  const timer = setInterval(() => { const now = Date.now(); stall = Math.max(stall, now - last - 20); last = now; }, 20);
  await new Promise((r) => setTimeout(r, 60)); // let the timer settle
  last = Date.now();
  const result = await work();
  await new Promise((r) => setTimeout(r, 40));
  clearInterval(timer);
  return { stall, result };
}

test.before(() => {
  execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
  const db = new Database(dbFile);
  db.prepare(`INSERT INTO "User" ("id","name","email","passwordHash","role","isActive","createdAt","updatedAt") VALUES ('u1','A','a@t','x','ADMIN',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run();
  db.exec(`CREATE TABLE IF NOT EXISTS "Bulk" ("id" INTEGER PRIMARY KEY, "blob" BLOB)`);
  const ins = db.prepare(`INSERT INTO "Bulk" ("blob") VALUES (?)`);
  const chunk = randomBytes(64 * 1024);
  db.transaction(() => { for (let i = 0; i < 960; i++) ins.run(chunk); })(); // ~60 MB
  db.close();
  mkdirSync(uploads, { recursive: true });
  for (let i = 0; i < 12; i++) writeFileSync(path.join(uploads, `photo-${i}.bin`), randomBytes(10 * 1024 * 1024)); // ~120 MB of "photos"
});

test("snapshot + integrity check run in a worker: result is correct and the event loop keeps ticking", async () => {
  const snap = path.join(dir, "snap.db");
  const { stall, result } = await worstLoopStall(() => snapshotDatabase(dbFile, snap));
  assert.equal(result.integrity, "ok");
  assert.equal(result.userCount, 1);
  assert.ok(existsSync(snap));
  console.log("@@ snapshot-stall-ms", stall);
  assert.ok(stall < 150, `event loop stalled ${stall} ms during the snapshot (limit 150)`);
});

test("tar of the uploads runs as an async child: archive is valid and the event loop keeps ticking", async () => {
  const archive = path.join(dir, "backup.tar.gz");
  const { stall, result } = await worstLoopStall(() => runTar(["--force-local", "-czf", archive, "-C", path.dirname(uploads), path.basename(uploads)]));
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(archive) && readFileSync(archive).length > 1_000_000);
  console.log("@@ tar-stall-ms", stall);
  assert.ok(stall < 150, `event loop stalled ${stall} ms during tar (limit 150)`);
  const list = spawnSync("tar", ["--force-local", "-tzf", archive], { encoding: "utf8" });
  assert.match(list.stdout, /photo-0\.bin/);
});

test("a failing tar reports the error instead of throwing; a failing snapshot rejects", async () => {
  const bad = await runTar(["--force-local", "-czf", path.join(dir, "x.tar.gz"), "-C", dir, "does-not-exist"]);
  assert.notEqual(bad.status, 0);
  assert.ok(bad.stderr.length > 0);
  await assert.rejects(() => snapshotDatabase(path.join(dir, "missing-dir", "nope.db"), path.join(dir, "s2.db")));
});

test("contrast: the OLD synchronous way froze the loop for the whole archive time (this is the production bug)", async () => {
  const archive = path.join(dir, "old.tar.gz");
  const { stall } = await worstLoopStall(() => spawnSync("tar", ["--force-local", "-czf", archive, "-C", path.dirname(uploads), path.basename(uploads)]));
  console.log("@@ OLD-sync-tar-stall-ms", stall);
  assert.ok(stall > 150, `expected the sync tar to stall the loop for hundreds of ms, saw ${stall} ms`);
});

test("the backup and restore routes no longer call spawnSync or better-sqlite3 directly", () => {
  for (const f of ["src/app/api/backup/route.ts", "src/app/api/backup/restore/route.ts"]) {
    const src = readFileSync(path.join(process.cwd(), f), "utf8");
    assert.ok(!/spawnSync\(/.test(src), `${f}: no spawnSync`);
  }
  assert.ok(!/new Database\(/.test(readFileSync(path.join(process.cwd(), "src/app/api/backup/route.ts"), "utf8")), "backup route: no synchronous SQLite work on the request thread");
});
