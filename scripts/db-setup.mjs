// Sahara OS — offline-safe database setup.
//
// Applies prisma/migrations/00000000000000_init/migration.sql directly with
// better-sqlite3. This does the same job as `prisma migrate deploy` but
// never needs to reach the network, so it works even on machines/sandboxes
// that block Prisma's engine-download CDN (binaries.prisma.sh).
//
// On a normal machine with unrestricted internet access you can use the
// standard `npx prisma migrate dev` / `npx prisma migrate deploy` instead —
// both approaches produce an identical schema. See README.md.

import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = path.resolve(root, dbUrl.replace(/^file:/, ""));

mkdirSync(path.dirname(dbPath), { recursive: true });

const migrationPath = path.join(
  root,
  "prisma",
  "migrations",
  "00000000000000_init",
  "migration.sql"
);

if (!existsSync(migrationPath)) {
  console.error("Migration file not found:", migrationPath);
  process.exit(1);
}

const sql = readFileSync(migrationPath, "utf-8");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const alreadyInitialized = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='User'")
  .get();

if (alreadyInitialized) {
  console.log(`Database already initialized at ${dbPath} — skipping schema creation.`);
} else {
  db.exec(sql);
  console.log(`Sahara OS database created at ${dbPath}`);
}

db.close();
