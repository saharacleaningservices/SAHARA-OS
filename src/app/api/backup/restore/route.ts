import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { isSameOrigin } from "@/lib/csrf";

// Restores dev.db (and public/uploads) from a .tar.gz produced by GET
// /api/backup. Admin-only, requires typed confirmation client-side. Takes a
// timestamped safety copy of the current database before touching anything,
// then exits the process so Render restarts it against the restored file —
// safer than swapping the file under a live database connection.

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

  const formData = await request.formData();
  const file = formData.get("file");
  const confirm = String(formData.get("confirm") || "");
  if (confirm !== "RESTORE") {
    return NextResponse.json({ error: "Confirmation text did not match" }, { status: 400 });
  }
  if (!(file instanceof File)) {
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
    const tar = spawnSync("tar", ["--force-local", "-xzf", uploadPath, "-C", extractDir], { encoding: "utf8" });
    if (tar.status !== 0) {
      return NextResponse.json({ error: `Could not read the archive: ${tar.stderr || tar.error}` }, { status: 400 });
    }

    const restoredDbPath = path.join(extractDir, "dev.db");
    if (!fs.existsSync(restoredDbPath)) {
      return NextResponse.json({ error: "Archive doesn't contain a dev.db — not a Sahara OS backup" }, { status: 400 });
    }

    // Sanity-check: must be a real SQLite file with the core User table.
    try {
      const check = new Database(restoredDbPath, { readonly: true });
      const hasUsers = check.prepare(`SELECT COUNT(*) AS c FROM "User"`).get() as { c: number };
      check.close();
      if (!hasUsers || hasUsers.c < 1) throw new Error("no users in backup");
    } catch {
      return NextResponse.json({ error: "The backup file failed validation — restore aborted" }, { status: 400 });
    }

    // Safety copy of the current live database — never deleted automatically.
    const safetyStamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safetyPath = path.join(root, `dev.db.before-restore-${safetyStamp}`);
    fs.copyFileSync(dbPath, safetyPath);

    // Swap the database file.
    fs.copyFileSync(restoredDbPath, dbPath);

    // Swap uploads, if the archive has them.
    const restoredUploads = path.join(extractDir, "uploads");
    if (fs.existsSync(restoredUploads)) {
      const liveUploads = path.join(root, "public", "uploads");
      fs.rmSync(liveUploads, { recursive: true, force: true });
      fs.cpSync(restoredUploads, liveUploads, { recursive: true });
    }

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

    // Respond first, then exit so Render restarts against the new file
    // instead of swapping it under the live, already-open connection.
    setTimeout(() => process.exit(1), 300);
    return NextResponse.json({ success: true, restarting: true });
  } catch (err) {
    fs.rmSync(workdir, { recursive: true, force: true });
    return NextResponse.json({ error: `Restore failed: ${(err as Error).message}` }, { status: 500 });
  }
}
