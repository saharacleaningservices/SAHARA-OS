# Sahara OS — Disaster Recovery & Restore Guide

Written for the owner and for a future developer who has never touched this
codebase before. No Claude/ChatGPT/AI-specific knowledge is assumed anywhere
in this document.

## What Sahara OS's data actually is

- **Database**: a single SQLite file, `dev.db`, at the path in the
  `DATABASE_URL` environment variable (defaults to `./dev.db`, i.e. inside
  the app's own directory, unless a persistent disk path is configured on
  the deployment platform).
- **Uploaded files**: everything under `public/uploads/` (staff documents,
  payment attachments, gallery photos, etc.) — not stored in the database.
- **Application code**: this Git repository. Losing it is recovered by
  re-deploying from GitHub, not by "restoring" in the sense used below.

Both the database and `public/uploads/` are backed up together as one
`.tar.gz` archive by `GET /api/backup` (see `BACKUP.md` for how the
automated daily/off-site pipeline is wired up).

## Scenario: application crash / won't start

1. Check the deployment platform's logs first (Coolify → your app →
   Deployments/Logs, or `docker logs <container>` if you have server
   access). Most crashes are a missing environment variable or a bad
   deploy, not data loss — **don't restore a backup for this.**
2. Redeploy the last known-good commit from GitHub if a recent code change
   is the suspected cause.
3. Only proceed to "Restoring the database" below if the crash left the
   database file itself corrupted (rare — SQLite is durable against normal
   process crashes).

## Scenario: database corruption

1. Stop making any further writes if you can (put the app in maintenance
   mode, or point the domain elsewhere temporarily) — this limits how much
   new data would be lost if you have to restore.
2. Try the built-in integrity check first, from the server:
   ```
   node -e "const D=require('better-sqlite3'); const db=new D('./dev.db',{readonly:true}); console.log(db.pragma('integrity_check',{simple:true}))"
   ```
   If this prints `ok`, the database is not actually corrupted — look
   elsewhere (application-level bug) before restoring.
3. If it's genuinely corrupted, follow "Restoring the database" below with
   the most recent verified backup.

## Scenario: VPS failure / server replacement

1. Provision the replacement server and point Coolify (or your deployment
   tool) at it, following `DEPLOYMENT_GUIDE.md`.
2. Deploy the application from GitHub as normal — this recreates the code
   and an empty database.
3. Immediately follow "Restoring the database" below with the most recent
   off-site backup (S3, and optionally Google Drive — see `BACKUP.md`) to
   bring real data back onto the new server.
4. Re-point DNS if the server's IP changed.

## Scenario: code redeployment (routine)

This is not a disaster — Coolify's webhook redeploys automatically on every
push to the deploy branch. The database (on the persistent disk/volume) is
never touched by a code deploy; see the "Persistent-disk migration" comment
at the top of `scripts/render-start.mjs` for exactly how the app handles
first-boot vs. every-boot-after on a given disk.

## Restoring the database

**Owner-only (ADMIN role), from inside the app:**

1. Go to **Settings → System Recovery Backup**.
2. Click **Restore from Backup**, choose the `.tar.gz` file you want to
   restore (downloaded from S3/Drive, or from "Download Backup Now" earlier),
   and type `RESTORE` to confirm.
3. The app automatically:
   - validates the archive is really a Sahara OS backup (checks for a
     `dev.db` with a populated `User` table before touching anything),
   - takes a **timestamped safety copy of the current live database**
     (`dev.db.before-restore-<timestamp>`) before overwriting it — the 5
     most recent of these are always kept on disk,
   - swaps in the restored database and `public/uploads/`,
   - restarts the app process so it picks up the new file cleanly.
4. Confirm the restore actually worked (see "Verification after recovery"
   below) before telling anyone the incident is resolved.

**If the in-app restore itself is unavailable** (app won't start at all):
copy the backup's `dev.db` directly onto the server at the path
`DATABASE_URL` points to, and `public/uploads/` alongside it, then restart
the app manually.

### Undoing a restore that turns out to be wrong

Every restore leaves a safety copy of what was live immediately before it —
`dev.db.before-restore-<timestamp>`, in the application's root directory. To
undo: stop the app, copy that safety file back over the live `dev.db`,
restart. Do this within the retention window (the 5 most recent restores'
safety copies are kept; older ones are pruned automatically).

## Restore test — how to actually prove a backup works

A backup "existing" is not the same as a backup that restores cleanly. To
test one safely, without touching production:

1. On a separate machine (or a scratch copy of the deployment), set
   `DATABASE_URL` to a throwaway path, e.g. `file:./restore-test.db`.
2. Run `node scripts/db-setup.mjs` once against that path to get a valid
   empty schema (or skip this — the restore endpoint's own validation will
   check schema validity anyway).
3. Extract the backup archive and inspect its `dev.db` directly:
   ```
   node -e "const D=require('better-sqlite3'); const db=new D('<path-to-extracted>/dev.db',{readonly:true}); console.log(db.pragma('integrity_check',{simple:true})); console.log(db.prepare('SELECT COUNT(*) c FROM User').get()); console.log(db.prepare('SELECT COUNT(*) c FROM Lead').get()); console.log(db.prepare('SELECT COUNT(*) c FROM Job').get()); console.log(db.prepare('SELECT COUNT(*) c FROM Payment').get());"
   ```
4. Spot-check real records — pick a few customer names/numbers you know are
   real and confirm they're present, addresses look right, and a few
   Job/Payment rows have sensible amounts and dates.
5. Record the result: test date, which backup file was used (filename +
   timestamp), and pass/fail with the specific counts you checked. Only mark
   a restore test complete if you actually ran this against a real backup
   file and the counts/spot-checks looked right — not merely because the
   archive downloaded successfully.

### This project's own most recent restore-path verification

As part of writing this guide (2026-09-22), the backup+validation code path
was actually run against this repository's own local development database:
a `VACUUM INTO` snapshot was taken (the same call `GET /api/backup` makes),
then checked with `PRAGMA integrity_check` and a `User` row count — the same
two checks the restore endpoint requires before it will accept an uploaded
archive. Result: integrity `ok`, 5 users, 24 Jobs, 24 Payments present in the
snapshot, snapshot size 950 KB. This confirms the snapshot/validate mechanics
work correctly, but it is **not** a full end-to-end restore test (it did not
exercise the actual file-swap-and-restart step, and it used the local dev
database rather than a real S3/Drive-downloaded production archive). A full
production restore test still needs to be run by whoever has access to those
destinations; record that result here once done:

| Test date | Source backup | Result |
|---|---|---|
| 2026-09-22 | Local dev database snapshot (`VACUUM INTO`, not a downloaded S3/Drive archive) | Integrity `ok`; 5 users / 24 Jobs / 24 Payments read back correctly. Validation-only — full restore (file swap + restart) not exercised. |
| _(pending)_ | first real S3/Drive production backup | |

## Verification after recovery

After any restore, before considering the incident closed:

- [ ] App starts and the login page loads.
- [ ] Log in as an Admin account and confirm the dashboard shows real
      (non-zero, if data existed) numbers.
- [ ] Open a few real customer/Lead records — names, mobile numbers,
      addresses look correct.
- [ ] Open a few Job records — service, schedule, status look correct.
- [ ] Open Payments — a few real amounts/dates are present.
- [ ] Public booking form (`/book`) still loads and a test submission
      creates a Lead (delete the test lead afterwards).
- [ ] Uploaded files (staff docs, payment attachments, gallery photos) open
      correctly, not just their database references.

## File recovery (uploads only, not the whole database)

If only `public/uploads/` needs recovering (e.g. accidentally deleted files,
database itself is fine): extract just the `uploads/` folder from a backup
archive and copy it into place — no database restore needed, no app
restart required.
