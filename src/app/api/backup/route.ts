import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

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

export async function GET(request: NextRequest) {
  const token = process.env.BACKUP_TOKEN;
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

    const archive = path.join(workdir, "backup.tar.gz");
    const uploadsDir = path.join(root, "public", "uploads");
    // --force-local: don't treat a Windows "C:\..." path as host:path.
    const tarArgs = ["--force-local", "-czf", archive, "-C", workdir, "dev.db"];
    if (fs.existsSync(uploadsDir)) {
      tarArgs.push("-C", path.join(root, "public"), "uploads");
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
        },
      })
      .catch(() => {});

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
