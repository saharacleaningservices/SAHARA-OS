import { NextRequest, NextResponse } from "next/server";
import { runTar } from "@/lib/backup-async";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { uploadsRoot } from "@/lib/uploads";
import Database from "better-sqlite3";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { isSameOrigin } from "@/lib/csrf";

// Restores dev.db (and public/uploads) from a .tar.gz produced by GET
// /api/backup. Admin-only, requires typed confirmation client-side. Takes a
// timestamped safety copy of the current database before touching anything,
// then exits the process so Coolify restarts it against the restored file —
// safer than swapping the file under a live database connection.
//
// Every failure path below writes a BackupEvent{kind:"RESTORE", status:
// "FAILED"} plus an AuditLog row, mirroring the logging GET /api/backup
// already does on every path (src/app/api/backup/route.ts) — previously
// this route only logged on success, so a failed restore left no trace for
// the admin who ran it or anyone auditing later.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 });
  }
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 401 });
  }

  // Fire-and-forget, mirroring the backup route's pattern — logging must
  // never itself cause the restore response to fail or hang.
  function logFailure(reason: string, fileName?: string) {
    db.backupEvent
      .create({
        data: {
          kind: "RESTORE",
          triggeredBy: session!.email,
          fileName: fileName ?? null,
          status: "FAILED",
          notes: reason,
        },
      })
      .catch(() => {});
    db.auditLog
      .create({
        data: {
          entityType: "Backup",
          entityId: fileName || "upload",
          action: "RESTORE_BACKUP_FAILED",
          summary: reason,
          actorName: session!.name,
          actorEmail: session!.email,
        },
      })
      .catch(() => {});
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const confirm = String(formData.get("confirm") || "");
  if (confirm !== "RESTORE") {
    logFailure("Restore rejected — confirmation text did not match");
    return NextResponse.json({ error: "Confirmation text did not match" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    logFailure("Restore rejected — no file provided");
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const root = process.cwd();
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = path.resolve(root, dbUrl.replace(/^file:/, ""));
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "sahara-restore-"));

  try {
    const uploadPath = path.join(workdir, "upload.tar.gz");
    fs.writeFileSync(uploadPath, Buffer.from(await file.arrayBuffer()));

    const extractDir = path.join(workdir, "extracted");
    fs.mkdirSync(extractDir);
    const tar = await runTar(["--force-local", "-xzf", uploadPath, "-C", extractDir]);
    if (tar.status !== 0) {
      logFailure(`Could not read the archive: ${tar.stderr}`, file.name);
      fs.rmSync(workdir, { recursive: true, force: true });
      return NextResponse.json({ error: `Could not read the archive: ${tar.stderr}` }, { status: 400 });
    }

    const restoredDbPath = path.join(extractDir, "dev.db");
    if (!fs.existsSync(restoredDbPath)) {
      logFailure("Archive doesn't contain a dev.db — not a Sahara OS backup", file.name);
      fs.rmSync(workdir, { recursive: true, force: true });
      return NextResponse.json({ error: "Archive doesn't contain a dev.db — not a Sahara OS backup" }, { status: 400 });
    }

    // Sanity-check: must be a real SQLite file with the core User table.
    try {
      const check = new Database(restoredDbPath, { readonly: true });
      const hasUsers = check.prepare(`SELECT COUNT(*) AS c FROM "User"`).get() as { c: number };
      check.close();
      if (!hasUsers || hasUsers.c < 1) throw new Error("no users in backup");
    } catch {
      logFailure("The backup file failed validation (SQLite/User-table check) — restore aborted", file.name);
      fs.rmSync(workdir, { recursive: true, force: true });
      return NextResponse.json({ error: "The backup file failed validation — restore aborted" }, { status: 400 });
    }

    // Safety copy of the current live database, kept as a rolling window of
    // the 5 most recent (2026-09-22 retention policy — previously these
    // accumulated forever). The one just about to be created is always kept;
    // this only prunes ones already on disk from earlier restores.
    const safetyStamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safetyPath = path.join(root, `dev.db.before-restore-${safetyStamp}`);
    const SAFETY_COPY_RETENTION = 5;
    try {
      const existingCopies = fs
        .readdirSync(root)
        .filter((f) => f.startsWith("dev.db.before-restore-"))
        .sort();
      const toDelete = existingCopies.slice(0, Math.max(0, existingCopies.length - (SAFETY_COPY_RETENTION - 1)));
      for (const f of toDelete) fs.rmSync(path.join(root, f), { force: true });
    } catch {
      // Retention is best-effort — never block a restore over cleanup failing.
    }
    fs.copyFileSync(dbPath, safetyPath);

    // Swap the database file.
    fs.copyFileSync(restoredDbPath, dbPath);

    // Swap uploads, if the archive has them.
    const restoredUploads = path.join(extractDir, "uploads");
    if (fs.existsSync(restoredUploads)) {
      const liveUploads = uploadsRoot();
      fs.rmSync(liveUploads, { recursive: true, force: true });
      fs.cpSync(restoredUploads, liveUploads, { recursive: true });
    }

    db.backupEvent
      .create({
        data: {
          kind: "RESTORE",
          triggeredBy: session.email,
          fileName: file.name || "upload",
          status: "SUCCESS",
          notes: `Safety copy: ${path.basename(safetyPath)}`,
        },
      })
      .catch(() => {});
    await db.auditLog.create({
      data: {
        entityType: "Backup",
        entityId: file.name || "upload",
        action: "RESTORE_BACKUP",
        summary: `Restored database from uploaded backup (safety copy: ${path.basename(safetyPath)})`,
        actorName: session.name,
        actorEmail: session.email,
      },
    });

    fs.rmSync(workdir, { recursive: true, force: true });

    // Respond first, then exit so Coolify restarts against the new file
    // instead of swapping it under the live, already-open connection.
    setTimeout(() => process.exit(1), 300);
    return NextResponse.json({ success: true, restarting: true, safetyFile: path.basename(safetyPath) });
  } catch (err) {
    logFailure(`Restore failed: ${(err as Error).message}`, file instanceof File ? file.name : undefined);
    fs.rmSync(workdir, { recursive: true, force: true });
    return NextResponse.json({ error: `Restore failed: ${(err as Error).message}` }, { status: 500 });
  }
}
