import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { uploadsRoot } from "@/lib/uploads";
import Database from "better-sqlite3";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getResolvedIntegrations, markBackupVerified } from "@/server/integrations";

// Streams a gzip tarball containing a consistent snapshot of the SQLite
// database plus everything under public/uploads. Consumed by the daily
// GitHub Actions backup workflow (.github/workflows/backup.yml) and by the
// admin "Download Backup Now" button on /settings.
//
// Auth: Authorization: Bearer <BACKUP_TOKEN> (automation) OR a logged-in
// Admin session cookie (in-app button). The route is allow-listed in
// src/middleware.ts so one of these is the only gate.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Retention (2026-09-22) — BackupEvent rows previously accumulated forever.
// Keeps the most recent 500 rows (daily backups ≈ 16 months of history),
// always preferring to keep newer rows over older ones. Best-effort: never
// allowed to fail or delay the actual backup response.
async function trimBackupEventHistory() {
  const KEEP = 500;
  const cutoff = await db.backupEvent.findMany({
    orderBy: { createdAt: "desc" },
    skip: KEEP,
    take: 1,
    select: { createdAt: true },
  });
  if (cutoff.length === 0) return;
  await db.backupEvent.deleteMany({ where: { createdAt: { lt: cutoff[0].createdAt } } });
}

export async function GET(request: NextRequest) {
  // Token comes from /settings → Integrations first, then the BACKUP_TOKEN
  // env var (see src/server/integrations.ts).
  const { backup } = await getResolvedIntegrations();
  const token = backup.token;
  const provided = request.headers.get("authorization") ?? "";
  const isTokenAuth = Boolean(token) && provided === `Bearer ${token}`;

  const session = isTokenAuth ? null : await getSession();
  const isAdminAuth = session?.role === "ADMIN";

  if (!isTokenAuth && !isAdminAuth) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const root = process.cwd();
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = path.resolve(root, dbUrl.replace(/^file:/, ""));
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "sahara-backup-"));

  try {
    // VACUUM INTO writes a clean, transactionally-consistent copy without
    // touching the live database file.
    const snapshot = path.join(workdir, "dev.db");
    const liveDb = new Database(dbPath);
    liveDb.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
    liveDb.close();

    // Verify the snapshot before anything else touches it — never ship a
    // backup that wouldn't actually restore.
    const check = new Database(snapshot, { readonly: true });
    const integrity = check.pragma("integrity_check", { simple: true }) as string;
    const { c: userCount } = check.prepare(`SELECT COUNT(*) AS c FROM "User"`).get() as { c: number };
    check.close();
    if (integrity !== "ok" || userCount < 1) {
      fs.rmSync(workdir, { recursive: true, force: true });
      db.backupEvent
        .create({
          data: {
            kind: isAdminAuth ? "MANUAL" : "AUTO",
            triggeredBy: isAdminAuth ? session!.email : "github-action",
            status: "FAILED",
            notes: `Integrity check failed before delivery: ${integrity}, users=${userCount}`,
          },
        })
        .catch(() => {});
      return new NextResponse(`Backup integrity check failed (${integrity}) — aborted, nothing was sent.`, { status: 500 });
    }

    const archive = path.join(workdir, "backup.tar.gz");
    // Persistent uploads folder (lib/uploads.ts); archived as "uploads/" either way.
    const uploadsDir = fs.existsSync(uploadsRoot()) ? uploadsRoot() : path.join(root, "public", "uploads");
    // --force-local: don't treat a Windows "C:\..." path as host:path.
    const tarArgs = ["--force-local", "-czf", archive, "-C", workdir, "dev.db"];
    if (fs.existsSync(uploadsDir)) {
      tarArgs.push("-C", path.dirname(uploadsDir), path.basename(uploadsDir));
    }
    const tar = spawnSync("tar", tarArgs, { encoding: "utf8" });
    if (tar.status !== 0) {
      fs.rmSync(workdir, { recursive: true, force: true });
      return new NextResponse(`tar failed: ${tar.stderr || tar.error}`, { status: 500 });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `sahara-os-${stamp}.tar.gz`;
    const sizeBytes = fs.statSync(archive).size;

    db.backupEvent
      .create({
        data: {
          kind: isAdminAuth ? "MANUAL" : "AUTO",
          triggeredBy: isAdminAuth ? session!.email : "github-action",
          fileName: filename,
          sizeBytes,
          status: "SUCCESS",
          notes: `Integrity check: ${integrity}, ${userCount} user(s)`,
        },
      })
      .catch(() => {});
    db.auditLog
      .create({
        data: {
          entityType: "Backup",
          entityId: filename,
          action: "BACKUP",
          summary: `${isAdminAuth ? "Manual" : "Automatic"} backup created (${(sizeBytes / 1024).toFixed(0)} KB, integrity ${integrity})`,
          actorName: isAdminAuth ? session!.name : "GitHub Action",
          actorEmail: isAdminAuth ? session!.email : null,
        },
      })
      .catch(() => {});
    // Records "backup pipeline confirmed working" for the Integrations page.
    markBackupVerified().catch(() => {});
    trimBackupEventHistory().catch(() => {});

    const nodeStream = fs.createReadStream(archive);
    nodeStream.on("close", () => fs.rmSync(workdir, { recursive: true, force: true }));

    return new NextResponse(Readable.toWeb(nodeStream) as unknown as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    fs.rmSync(workdir, { recursive: true, force: true });
    db.backupEvent
      .create({ data: { kind: isAdminAuth ? "MANUAL" : "AUTO", status: "FAILED", notes: (err as Error).message } })
      .catch(() => {});
    return new NextResponse(`Backup failed: ${(err as Error).message}`, { status: 500 });
  }
}
