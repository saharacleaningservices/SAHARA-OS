import { db } from "@/lib/db";
import { notify } from "@/server/notify";

// Backup freshness (2026-10-14). The nightly GitHub Action backs up at 02:00 IST; once it has delivered the archive to
// Google Drive and verified its size it POSTs /api/backup/confirm, which records a BackupEvent with status DELIVERED.
// "Last verified backup" = the newest DELIVERED event. Until the first confirmation ever arrives (rollout window) the
// newest automatic SUCCESS snapshot is used instead, flagged as LEGACY_SNAPSHOT.
export const STALE_AFTER_HOURS = 26;
const ALERT_FROM_HOUR_IST = 8; // never wake the owner at night; the alert waits for the morning
const ALERT_TO_HOUR_IST = 22;
const REPEAT_HOURS = 24; // at most one alert per day while the backup stays overdue

export type BackupHealth = {
  state: "OK" | "STALE" | "NONE";
  lastAt: Date | null;
  ageHours: number | null;
  source: "DELIVERED" | "LEGACY_SNAPSHOT" | null;
};

export async function getBackupHealth(now: Date = new Date()): Promise<BackupHealth> {
  let source: BackupHealth["source"] = "DELIVERED";
  let last = await db.backupEvent.findFirst({ where: { status: "DELIVERED" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (!last) {
    source = "LEGACY_SNAPSHOT";
    last = await db.backupEvent.findFirst({ where: { status: "SUCCESS", kind: "AUTO" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  }
  if (!last) return { state: "NONE", lastAt: null, ageHours: null, source: null };
  const ageHours = (now.getTime() - last.createdAt.getTime()) / 3_600_000;
  return { state: ageHours > STALE_AFTER_HOURS ? "STALE" : "OK", lastAt: last.createdAt, ageHours, source };
}

const istHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(d)) % 24;

/** Sends the Super Admin one in-app alert (loud, critical) when the last verified backup is overdue. Never throws. */
export async function maybeBackupStaleAlert(now: Date = new Date()): Promise<"ok" | "alerted" | "recently-alerted" | "night" | "error"> {
  try {
    const h = await getBackupHealth(now);
    if (h.state === "OK") return "ok";
    const hour = istHour(now);
    if (hour < ALERT_FROM_HOUR_IST || hour >= ALERT_TO_HOUR_IST) return "night";
    const since = new Date(now.getTime() - REPEAT_HOURS * 3_600_000);
    if (await db.notification.count({ where: { kind: "BACKUP_STALE", createdAt: { gte: since } } })) return "recently-alerted";
    const when = h.lastAt ? h.lastAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : null;
    await notify({
      kind: "BACKUP_STALE",
      title: "Backup overdue — no verified backup in 26+ hours",
      body: when
        ? `Last backup delivered to Google Drive: ${when} IST (${Math.floor(h.ageHours ?? 0)} h ago). Check GitHub → Actions → "Sahara OS Enterprise Backup".`
        : "No verified backup has been recorded yet. Check GitHub → Actions → \"Sahara OS Enterprise Backup\".",
      href: "/settings",
      critical: true,
      tag: "backup-stale",
    });
    return "alerted";
  } catch (e) {
    console.error("[backup-health] check failed:", e);
    return "error";
  }
}
