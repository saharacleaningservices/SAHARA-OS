// Sahara OS — Render start script.
//
// Ensures the schema exists (idempotent), seeds demo data only on a
// completely fresh database (so redeploys/restarts never duplicate data),
// then boots the production server on Render's assigned $PORT.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// 1. Make sure tables exist (no-ops if they already do).
run("node", ["scripts/db-setup.mjs"]);

// 2. Seed only if the database has no users yet (first boot on a fresh disk).
const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = path.resolve(root, dbUrl.replace(/^file:/, ""));
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
run("npx", ["next", "start", "-p", process.env.PORT || "3000"]);
