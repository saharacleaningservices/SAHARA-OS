// Non-blocking building blocks for /api/backup and /api/backup/restore.
//
// Root cause of the "Server unhealthy — event loop blocked 17991 ms" alert (2026-10-23): the backup route did its heavy work on the
// request thread — better-sqlite3's VACUUM INTO and PRAGMA integrity_check (both fully synchronous over the whole database) and
// child_process.spawnSync("tar") over the photo uploads. While any of those run, Node cannot answer a single other request, so every
// user (CRM and Staff App) froze for as long as the backup took. They now run in a worker thread / a normal async child process, so
// the server keeps serving while a backup is being made.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { Worker } from "node:worker_threads";

/** Runs `tar` without blocking the event loop. Resolves with its exit status and stderr (never rejects). */
export function runTar(args: string[]): Promise<{ status: number | null; stderr: string }> {
  return new Promise((resolve) => {
    let stderr = "";
    const child = spawn("tar", args, { stdio: ["ignore", "ignore", "pipe"] });
    child.stderr.on("data", (d: Buffer) => { if (stderr.length < 4000) stderr += d.toString(); });
    child.on("error", (e) => resolve({ status: null, stderr: String(e) }));
    child.on("close", (code) => resolve({ status: code, stderr }));
  });
}

const SNAPSHOT_WORKER = `
const { parentPort, workerData } = require("node:worker_threads");
const Database = require(workerData.sqliteModule);
try {
  const live = new Database(workerData.dbPath);
  live.exec("VACUUM INTO '" + workerData.snapshot.replace(/'/g, "''") + "'");
  live.close();
  const check = new Database(workerData.snapshot, { readonly: true });
  const integrity = check.pragma("integrity_check", { simple: true });
  const userCount = check.prepare('SELECT COUNT(*) AS c FROM "User"').get().c;
  check.close();
  parentPort.postMessage({ ok: true, integrity: String(integrity), userCount });
} catch (e) {
  parentPort.postMessage({ ok: false, error: String(e && e.message || e) });
}
`;

/** VACUUM INTO + integrity check + user count, in a worker thread (the request thread stays free). Rejects on any failure. */
export function snapshotDatabase(dbPath: string, snapshot: string): Promise<{ integrity: string; userCount: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(SNAPSHOT_WORKER, { eval: true, workerData: { dbPath, snapshot, sqliteModule: createRequire(path.join(process.cwd(), "package.json")).resolve("better-sqlite3") } });
    worker.once("message", (m: { ok: boolean; integrity?: string; userCount?: number; error?: string }) => {
      if (m.ok) resolve({ integrity: m.integrity ?? "", userCount: m.userCount ?? 0 });
      else reject(new Error(m.error ?? "snapshot failed"));
    });
    worker.once("error", reject);
    worker.once("exit", (code) => { if (code !== 0) reject(new Error(`snapshot worker exited with code ${code}`)); });
  });
}
