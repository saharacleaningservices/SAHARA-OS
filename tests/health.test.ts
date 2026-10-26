// /api/health + proactive server-health alert. Run: npm run test:health
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-health-"));
const dbFile = path.join(dir, "t.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let health: typeof import("../src/server/health");
let db: typeof import("../src/lib/db").db;
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  health = await import("../src/server/health");
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("healthy server: ok, DB answers fast, memory / CPU / event-loop are reported with sane values", async () => {
  const h = await health.collectHealth();
  assert.equal(h.status, "ok", h.reasons.join("; "));
  assert.equal(h.database.ok, true);
  assert.ok((h.database.latencyMs ?? 99999) < health.LIMITS.dbSlowMs);
  assert.equal(h.database.connection, "single (no pool)", "SQLite: one connection — reported honestly");
  assert.ok(h.memory.usedMB > 0 && h.memory.limitMB >= h.memory.usedMB && h.memory.usedPct >= 0 && h.memory.usedPct <= 100);
  assert.ok(["container", "process"].includes(h.memory.source));
  assert.ok(h.cpu.cores >= 1);
  assert.ok(h.eventLoop.p99Ms >= 0 && h.uptimeSec >= 0);
  assert.deepEqual(h.reasons, []);
});

test("a busy event loop is noticed (blocked ≥ 500 ms p99 → degraded, ≥ 3 s → unhealthy)", async () => {
  await health.collectHealth(); // starts the lag sampler
  await new Promise((r) => setTimeout(r, 300));
  const end = Date.now() + 900;
  while (Date.now() < end); // block the loop for 900 ms (margin over the 500 ms threshold: timers fire a little early under load)
  await new Promise((r) => setTimeout(r, 400));
  const h = await health.collectHealth();
  assert.ok(h.eventLoop.maxMs >= 500, `max ${h.eventLoop.maxMs}`);
  assert.ok(h.status === "degraded" || h.status === "unhealthy");
  assert.ok(h.reasons.some((r) => /event loop/i.test(r)));
});

test("database failure → unhealthy (503), reported without throwing", () => {
  // A fresh process whose DATABASE_URL points at a folder: SQLite cannot open it.
  const script = `
    process.env.DATABASE_URL = "file:${dir.replace(/\\/g, "/")}";
    import("./src/server/health.ts").then(async (mod) => {
      const m = mod.collectHealth ? mod : mod.default;
      const h = await m.collectHealth();
      console.log(JSON.stringify({ status: h.status, ok: h.database.ok, why: h.reasons[0] ?? "" }));
      process.exit(0);
    }).catch((e) => { console.log(JSON.stringify({ crashed: String(e).slice(0, 80) })); process.exit(0); });`;
  const out = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { encoding: "utf8", cwd: process.cwd() }).trim().split("\n").pop()!;
  const r = JSON.parse(out);
  assert.ok(!r.crashed, out);
  assert.equal(r.status, "unhealthy");
  assert.equal(r.ok, false);
});

test("alert: silent when healthy; when unhealthy for the streak it alerts the Super Admin ONCE per 6 hours", async () => {
  const admin = await db.user.create({ data: { name: "Altaf", email: "a@t", role: "ADMIN", passwordHash: "x" } });
  health.__resetHealthAlertState();
  assert.equal(await health.maybeHealthAlert(), "ok");
  assert.equal(await db.notification.count({ where: { userId: admin.id, kind: "OPS_ESCALATION" } }), 0);
  // Drive the streak: cheap deterministic trigger = block the loop so every check is degraded.
  let last = "quiet";
  for (let i = 0; i < 6; i++) {
    const end = Date.now() + 560;
    while (Date.now() < end);
    await new Promise((r) => setTimeout(r, 300));
    last = await health.maybeHealthAlert(Date.now());
  }
  const n = await db.notification.count({ where: { userId: admin.id, kind: "OPS_ESCALATION", title: { contains: "Server" } } });
  assert.equal(n, 1, `exactly one alert after a sustained streak (last=${last})`);
  const again = await health.maybeHealthAlert(Date.now() + 3_600_000);
  assert.notEqual(again, "alerted", "silent inside the 6-hour window");
  assert.equal(await db.notification.count({ where: { userId: admin.id, kind: "OPS_ESCALATION", title: { contains: "Server" } } }), 1);
});

test("route: public answer is { status } only; details need Admin or a 16+ char HEALTH_TOKEN (timing-safe); rate-limited; HEAD works", () => {
  const r = readFileSync("src/app/api/health/route.ts", "utf8");
  assert.ok(r.includes("detailed ? report : { status: report.status }"));
  assert.ok(r.includes("timingSafeEqual") && r.includes("want.length < 16"));
  assert.ok(r.includes("rateLimit(") && r.includes("export async function HEAD"));
  assert.ok(r.includes("report.status === \"unhealthy\" ? 503 : 200"));
  assert.ok(readFileSync("src/middleware.ts", "utf8").includes(`"/api/health"`), "reachable without a login");
  assert.ok(readFileSync("src/instrumentation.ts", "utf8").includes("maybeHealthAlert()"), "checked every minute by the scheduler");
});
