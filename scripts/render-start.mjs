// Sahara OS — Render start script.
//
// Ensures the schema exists (idempotent), seeds demo data only on a
// completely fresh database (so redeploys/restarts never duplicate data),
// then boots the production server on Render's assigned $PORT.
//
// Persistent-disk migration (one-time, automatic, idempotent): when
// DATABASE_URL points OUTSIDE this git checkout — i.e. at a Render
// persistent Disk mount like /var/data/dev.db — and no database exists yet
// at that path, this bootstraps it from the git-committed ./dev.db before
// anything else runs, so the very first boot on the new disk carries
// forward real data instead of starting empty. Every boot after that finds
// the disk file already present and does nothing here — from then on the
// disk (not the git checkout) is the single source of truth, and it is
// never touched again by a deploy.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { checkEnv } from "./env-check.mjs";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Boot timeline (2026-11-06): number each boot of this container (the /tmp counter survives container restarts) and
// stamp each phase, so a restart loop and a hang look different in the Coolify log.
const bootNo = (() => {
  let n = 1;
  try { n = Number(readFileSync("/tmp/sahara-boot-count", "utf8")) + 1 || 1; } catch {}
  try { writeFileSync("/tmp/sahara-boot-count", String(n)); } catch {}
  return n;
})();
const boot = (msg) => console.log(`[boot #${bootNo} ${new Date().toISOString().slice(11, 19)}Z] ${msg}`);
boot("render-start begin");

// 0a. Fail fast on a missing essential variable; only warn about the rest (see scripts/env-check.mjs).
{
  const { errors, warnings } = checkEnv(process.env);
  for (const w of warnings) console.warn(`[env] warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`[env] ERROR: ${e}`);
    console.error("[env] Refusing to start. Fix the variable(s) above in Coolify and redeploy.");
    process.exit(1);
  }
}

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = path.resolve(root, dbUrl.replace(/^file:/, ""));
const committedDbPath = path.join(root, "dev.db");
const isExternalPath = !dbPath.startsWith(root + path.sep) && dbPath !== committedDbPath;

// 0. One-time bootstrap onto a persistent disk (see comment above).
if (isExternalPath && !existsSync(dbPath) && existsSync(committedDbPath)) {
  console.log(`Persistent disk at ${dbPath} is empty — bootstrapping it from the committed database...`);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  copyFileSync(committedDbPath, dbPath);
  const check = new Database(dbPath, { readonly: true });
  const integrity = check.pragma("integrity_check", { simple: true });
  const { c: bootstrappedUsers } = check.prepare("SELECT COUNT(*) as c FROM User").get();
  check.close();
  if (integrity !== "ok") {
    console.error(`Bootstrap copy failed integrity check (${integrity}) — refusing to start.`);
    process.exit(1);
  }
  console.log(`Bootstrap complete: ${bootstrappedUsers} user(s) carried onto the persistent disk. Integrity: ${integrity}.`);
} else if (isExternalPath) {
  console.log(`Using existing persistent database at ${dbPath} (not touched by this deploy).`);
}

// 1. Make sure tables exist (no-ops if they already do). Run asynchronously with a watchdog that prints the statement
// db-setup is on every 15 s, so a blocked migration names itself in the log.
boot("db-setup begin");
await new Promise((resolve) => {
  const started = Date.now();
  const child = spawn("node", ["scripts/db-setup.mjs"], { cwd: root, stdio: "inherit", env: process.env });
  const watchdog = setInterval(() => {
    let current = "?";
    try { current = readFileSync("/tmp/sahara-db-setup-current", "utf8"); } catch {}
    boot(`db-setup still running after ${Math.round((Date.now() - started) / 1000)}s — on: ${current}`);
  }, 15000);
  child.on("exit", (code, signal) => {
    clearInterval(watchdog);
    boot(`db-setup exit code=${code} signal=${signal ?? "-"} after ${Math.round((Date.now() - started) / 1000)}s`);
    if (code !== 0) process.exit(code ?? 1);
    resolve();
  });
});

// 2. Seed only if the database has no users yet (first boot on a fresh disk).
const db = new Database(dbPath);
const { c: userCount } = db.prepare("SELECT COUNT(*) as c FROM User").get();
db.close();

if (userCount === 0) {
  console.log("No users found — seeding demo data...");
  run("npx", ["tsx", "prisma/seed.ts"]);
} else {
  console.log(`Database already has ${userCount} user(s) — skipping seed.`);
}

// 3. Start the production server on Render's assigned port.
boot("next start begin");
run("npx", ["next", "start", "-p", process.env.PORT || "3000"]);
