import fs from "node:fs";
import os from "node:os";
import { db } from "@/lib/db";

// Server health (2026-10-18, after the 17 Oct outage): a few cheap, honest measurements.
//   database   one `SELECT 1` with a timeout — proves the SQLite file opens, reads and answers quickly.
//              SQLite via better-sqlite3 is ONE connection in this process: there is no connection pool to
//              exhaust, so what is reported is latency, not pool size.
//   memory     container memory (cgroup) vs its limit when running in Docker/Coolify, else process RSS vs RAM.
//   cpu        1-minute load average per core + this process's CPU use since the previous check.
//   eventLoop  how late timers fire — the first symptom of a stuck / overloaded Node process.
// Thresholds turn those into ok / degraded / unhealthy; /api/health serves them (see app/api/health/route.ts).

export type HealthStatus = "ok" | "degraded" | "unhealthy";
export type HealthReport = {
  status: HealthStatus;
  reasons: string[];
  at: string;
  uptimeSec: number;
  database: { engine: "sqlite"; connection: "single (no pool)"; ok: boolean; latencyMs: number | null; error?: string };
  memory: { source: "container" | "process"; usedMB: number; limitMB: number; usedPct: number; rssMB: number; heapUsedMB: number };
  cpu: { cores: number; loadPerCore: number | null; processPct: number | null };
  eventLoop: { p99Ms: number; maxMs: number };
};

export const LIMITS = {
  dbSlowMs: 1000,
  dbTimeoutMs: 2500,
  memDegradedPct: 85,
  memUnhealthyPct: 95,
  loopDegradedMs: 500,
  loopUnhealthyMs: 3000,
  loadDegradedPerCore: 2,
};

const MB = 1024 * 1024;
const num = (s: string | null) => {
  const n = s ? Number(s.trim()) : NaN;
  return Number.isFinite(n) ? n : null;
};
const read = (p: string) => {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
};

/** Container memory (cgroup v2, then v1) when a real limit is set; otherwise the machine's RAM. */
export function readMemory() {
  const m = process.memoryUsage();
  const limitV2 = read("/sys/fs/cgroup/memory.max");
  const usedV2 = num(read("/sys/fs/cgroup/memory.current"));
  const limitV1 = num(read("/sys/fs/cgroup/memory/memory.limit_in_bytes"));
  const usedV1 = num(read("/sys/fs/cgroup/memory/memory.usage_in_bytes"));
  const limit = limitV2 && limitV2.trim() !== "max" ? num(limitV2) : limitV1 && limitV1 < os.totalmem() * 2 ? limitV1 : null;
  const used = limitV2 ? usedV2 : usedV1;
  if (limit && used != null) {
    return { source: "container" as const, usedMB: Math.round(used / MB), limitMB: Math.round(limit / MB), usedPct: Math.round((used / limit) * 100), rssMB: Math.round(m.rss / MB), heapUsedMB: Math.round(m.heapUsed / MB) };
  }
  const total = os.totalmem();
  return { source: "process" as const, usedMB: Math.round(m.rss / MB), limitMB: Math.round(total / MB), usedPct: Math.round((m.rss / total) * 100), rssMB: Math.round(m.rss / MB), heapUsedMB: Math.round(m.heapUsed / MB) };
}

// Event-loop lag: a 250 ms timer that records how late it fires (node's own histogram under-reports long
// blocks, so this is measured directly). Keeps the last ~60 s; started on the first health check.
const TICK_MS = 250;
const RING = 240;
const drifts: number[] = [];
let sampler: ReturnType<typeof setInterval> | null = null;
let lastTick = 0;
function startSampler() {
  if (sampler) return;
  lastTick = Date.now();
  sampler = setInterval(() => {
    const now = Date.now();
    drifts.push(Math.max(0, now - lastTick - TICK_MS));
    if (drifts.length > RING) drifts.shift();
    lastTick = now;
  }, TICK_MS);
  sampler.unref?.();
}
const lag = () => {
  if (!drifts.length) return { p99: 0, max: 0 };
  const sorted = [...drifts].sort((a, b) => a - b);
  return { p99: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))], max: sorted[sorted.length - 1] };
};

let lastCpu = { at: Date.now(), usage: process.cpuUsage() };

async function checkDb() {
  const started = Date.now();
  try {
    await Promise.race([db.$queryRaw`SELECT 1`, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), LIMITS.dbTimeoutMs).unref?.())]);
    return { engine: "sqlite" as const, connection: "single (no pool)" as const, ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return { engine: "sqlite" as const, connection: "single (no pool)" as const, ok: false, latencyMs: null, error: String((e as Error).message).slice(0, 120) };
  }
}

export async function collectHealth(): Promise<HealthReport> {
  startSampler();
  const database = await checkDb();
  const memory = readMemory();

  const nowMs = Date.now();
  const cpu = process.cpuUsage(lastCpu.usage);
  const wallMs = Math.max(1, nowMs - lastCpu.at);
  const processPct = wallMs >= 1000 ? Math.round(((cpu.user + cpu.system) / 1000 / wallMs / os.cpus().length) * 100) : null;
  if (wallMs >= 1000) lastCpu = { at: nowMs, usage: process.cpuUsage() };
  const cores = os.cpus().length || 1;
  const load = os.loadavg()[0]; // always 0 on Windows
  const loadPerCore = load > 0 ? Math.round((load / cores) * 100) / 100 : null;

  const { p99, max } = lag();

  const reasons: string[] = [];
  let status: HealthStatus = "ok";
  const bump = (s: HealthStatus, why: string) => {
    reasons.push(why);
    if (s === "unhealthy" || (s === "degraded" && status === "ok")) status = s;
  };
  if (!database.ok) bump("unhealthy", `database: ${database.error}`);
  else if ((database.latencyMs ?? 0) > LIMITS.dbSlowMs) bump("degraded", `database slow (${database.latencyMs} ms)`);
  if (memory.usedPct >= LIMITS.memUnhealthyPct) bump("unhealthy", `memory ${memory.usedPct}% of ${memory.limitMB} MB`);
  else if (memory.usedPct >= LIMITS.memDegradedPct) bump("degraded", `memory ${memory.usedPct}% of ${memory.limitMB} MB`);
  if (max >= LIMITS.loopUnhealthyMs) bump("unhealthy", `event loop blocked ${max} ms`);
  else if (p99 >= LIMITS.loopDegradedMs) bump("degraded", `event loop lag p99 ${p99} ms`);
  if (loadPerCore != null && loadPerCore >= LIMITS.loadDegradedPerCore) bump("degraded", `CPU load ${loadPerCore}/core`);

  return {
    status,
    reasons,
    at: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    database,
    memory,
    cpu: { cores, loadPerCore, processPct },
    eventLoop: { p99Ms: p99, maxMs: max },
  };
}

// ── Proactive alert (called every minute by the in-process scheduler) ───────────────────────────────────────
// One notification to the Super Admin when the server turns unhealthy, or degraded for 5 checks in a row, then
// silent for 6 h — so a slow memory climb is noticed before the container is killed, without alert spam.
const ALERT_EVERY_MS = 6 * 3_600_000;
let badStreak = 0;
let lastAlertAt = 0;

export async function maybeHealthAlert(now: number = Date.now()): Promise<"ok" | "alerted" | "quiet"> {
  try {
    const h = await collectHealth();
    badStreak = h.status === "ok" ? 0 : badStreak + 1;
    if (h.status !== "ok") console.warn(`[health] ${h.status}: ${h.reasons.join("; ")}`);
    const due = h.status === "unhealthy" || badStreak >= 5;
    if (!due || now - lastAlertAt < ALERT_EVERY_MS) return h.status === "ok" ? "ok" : "quiet";
    lastAlertAt = now;
    const { notify } = await import("@/server/notify");
    await notify({
      kind: "OPS_ESCALATION",
      title: h.status === "unhealthy" ? "Server unhealthy — check now" : "Server running hot — check soon",
      body: `${h.reasons.join("; ") || "Resource use is high"}. Memory ${h.memory.usedMB}/${h.memory.limitMB} MB, DB ${h.database.latencyMs ?? "down"} ms. If it keeps climbing, restart the app in Coolify before it crashes.`,
      href: "/dashboard",
      critical: true,
      tag: "server-health",
    });
    return "alerted";
  } catch (e) {
    console.error("[health] alert check failed:", e);
    return "quiet";
  }
}

/** Test hook: reset the in-process alert state and the lag window. */
export function __resetHealthAlertState() {
  badStreak = 0;
  lastAlertAt = 0;
  drifts.length = 0;
}
