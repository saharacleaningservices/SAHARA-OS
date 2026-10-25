# Server hardening and crash-proofing (2026-10-25)

What the repository now does by itself, and the settings that only exist in Coolify / on the VPS (so the owner or a developer with server access must check them).

## In the repository (shipped)
| Protection | Where |
|---|---|
| SQLite **WAL mode** + 10 s busy timeout — readers no longer block the writer during peak ad traffic | `scripts/db-setup.mjs` (runs on every boot; the mode is stored in the database file) |
| Backups stay consistent under WAL (`VACUUM INTO` snapshot); restore removes stale `-wal` / `-shm` files and checkpoints before the safety copy | `src/app/api/backup/route.ts`, `src/app/api/backup/restore/route.ts` |
| Container **HEALTHCHECK** on `/api/health` (200 ok/degraded, 503 unhealthy), 90 s start grace, 3 failures needed | `Dockerfile` |
| Health report: database latency, memory vs container limit, CPU, event-loop lag; Super Admin is notified when unhealthy | `src/server/health.ts`, `src/app/api/health/route.ts` |
| Backups never block the server (worker thread / async tar) | `src/lib/backup-async.ts` |
| Daily off-site backup to Google Drive (30 daily + 12 monthly, weekly encrypted copy) and uptime monitor | `.github/workflows/backup.yml`, uptime workflow |
| **One-command recovery** on a new server | `bash scripts/recover-from-backup.sh <backup.tar.gz> [data-dir]` (verifies integrity first, keeps the old database, clears stale WAL, runs `db-setup`) |

## In Coolify / on the VPS (NOT visible from the repository — please check)
1. **Restart policy:** Coolify → the app → *Advanced* → make sure the container restart policy is **Unless stopped** (Coolify's default for applications). With the HEALTHCHECK above, an unhealthy container is then restarted.
2. **Memory limit:** Coolify → the app → *Resources* → set **Memory limit** (for example 1 GB if the VPS has 2 GB, never more than ~75% of the VPS RAM) and **Memory swap**. The health report already compares usage to this limit, so a leak shows up as "degraded" before it hurts the VPS. Optional: set `NODE_OPTIONS=--max-old-space-size=<MB>` (about 75% of the container limit) as a runtime variable.
3. **CPU limit:** leave unset unless other apps share the VPS.
4. **Persistent volume:** confirm `/data` (database + uploads) is a Coolify persistent volume and `DATABASE_URL=file:/data/dev.db`.
5. **VPS basics:** `docker ps`, `docker stats --no-stream`, `free -h`, `df -h` — keep disk under 80% (backups, Docker images and logs fill it); add 2 GB swap if there is none; `docker system prune -f` for old images when disk is tight; enable Hostinger snapshots/backups for the VPS itself.
6. **Rollback:** Coolify → Deployments → redeploy an earlier build (does not undo database changes).

## Recovery drill (VPS lost)
1. New VPS → install Coolify → recreate the app from GitHub branch `coolify-deploy`, add the persistent volume and the environment variables (names in `DEVELOPER_HANDOVER.md`; values from the owner's records).
2. Download the newest `sahara-os-*.tar.gz` from the Google Drive backup folder.
3. With the app stopped: `bash scripts/recover-from-backup.sh sahara-os-<date>.tar.gz /data`.
4. Start the app, check `/api/health`, point DNS (Namecheap A records for `app`, `booking`, `crm`) at the new IP.
