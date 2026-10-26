import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getResolvedIntegrations } from "@/server/integrations";

// Called by the backup GitHub Action AFTER the archive was uploaded to Google Drive and its size verified there.
// Records a DELIVERED BackupEvent, which is what the stale-backup alert (src/server/backup-health.ts) measures.
// Auth: Authorization: Bearer <BACKUP_TOKEN> only (same token as /api/backup). Allow-listed in src/middleware.ts
// via the /api/backup prefix; this route does its own token check.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE_RE = /^sahara-os-[0-9A-Za-z._-]{1,80}\.tar\.gz(\.enc)?$/;

export async function POST(request: NextRequest) {
  const { backup } = await getResolvedIntegrations();
  const token = backup.token;
  if (!token || (request.headers.get("authorization") ?? "") !== `Bearer ${token}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { fileName?: unknown; sizeBytes?: unknown; destination?: unknown } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const sizeBytes = typeof body?.sizeBytes === "number" && Number.isInteger(body.sizeBytes) && body.sizeBytes > 0 ? body.sizeBytes : null;
  if (!FILE_RE.test(fileName) || sizeBytes === null) return NextResponse.json({ error: "fileName and sizeBytes are required" }, { status: 400 });
  const destination = body?.destination === "google-drive" ? "Google Drive" : "off-site storage";

  await db.backupEvent.create({
    data: { kind: "AUTO", triggeredBy: "github-action", fileName, sizeBytes, status: "DELIVERED", notes: `Delivered to ${destination} and size-verified` },
  });
  return NextResponse.json({ ok: true });
}
