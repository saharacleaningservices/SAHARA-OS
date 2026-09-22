# Automated off-site backups

**Status as of 2026-09-22**: fully working end-to-end. `BACKUP_TOKEN` is
set, and **Google Drive is the primary off-site destination** and is
confirmed uploading for real (run #44: uploaded a real archive, verified
present in the "Sahara OS Backups" Drive folder, owned by the account's own
quota — see `SAHARA_OS_STATUS.md` for the full verification log). No S3
bucket is configured (deliberately — "do not provision a new paid storage
service"); the S3 step is kept inert in the workflow in case a no-added-cost
bucket becomes available later.

**Important — GitHub Actions `schedule:` triggers run from the repo's
default branch (`main`), not the deploy branch (`coolify-deploy`).** A
failure email the same day traced back to exactly this: the 02:00 IST
scheduled run on `main` failed with a 401 because it executed *before*
`BACKUP_TOKEN` was added as a repo secret earlier that day — not a bug,
just stale timing (secrets are repo-wide, not branch-specific). Re-verified
by manually triggering `main`'s copy of the workflow (run #45): succeeded,
uploaded a real archive to the same Drive folder, retention correctly
tracked "2 daily + 0 monthly backup(s) retained". Both branches' backup
pipelines are independently confirmed working — see `SAHARA_OS_STATUS.md`
§3.23 for the full triage.

**Important technical note**: Google service accounts have **zero Drive
storage quota** of their own. An earlier attempt this session used a
dedicated service account (`sahara-os-backup-uploader@...`) with the Drive
folder shared to it as Editor — this authenticates fine but Google rejects
file *creation* with `storageQuotaExceeded`, because sharing a regular "My
Drive" folder as Editor does not grant a service account any quota to own
new files in. The fix: OAuth credentials authenticating as the owner's own
Google account (`contact@saharacleaningservices.com`), so uploaded files
count against the account's own storage and are visible as owned by "me" in
Drive. See Section 3 below for how this was set up.

A GitHub Actions workflow (`.github/workflows/backup.yml`) runs every day at
**02:00 IST** and:

1. calls `GET /api/backup` on the live app with a bearer token,
2. receives a `tar.gz` containing a consistent SQLite snapshot (`dev.db`, via
   `VACUUM INTO`) plus everything under `public/uploads/`,
3. verifies the archive (`.github/scripts/verify_backup.py`) before it's ever uploaded,
4. uploads it to **Google Drive** — the primary off-site destination (owner
   decision, 2026-09-22, superseding the 2026-09-21 "S3 primary" decision
   since no S3 bucket was ever actually provisioned). Authenticates as the
   owner's own Google account via OAuth, into the "Sahara OS Backups" folder,
5. on Sundays, additionally uploads a second, AES-256-encrypted copy (full
   weekly backup) to the same Drive folder (`.enc` suffix keeps it distinct),
6. optionally also uploads to **S3-compatible object storage** — inert
   unless a bucket is configured; skipped entirely otherwise,
7. applies retention in each destination it writes to (see below).

You can also run it on demand: repo → **Actions → Sahara OS Enterprise Backup
→ Run workflow**.

## One-time setup

### 1. App environment variable (Coolify)

Set on the Sahara OS application (Coolify → your app → Environment Variables),
or leave it to the app's own generated value from Settings → Integrations →
Backup, whichever you use as the source of truth:

| Key | Value |
|---|---|
| `BACKUP_TOKEN` | a long random string — generate one from Settings → Integrations → Backup → "Regenerate token", or with `openssl rand -base64 32` |

**Security note (2026-09-22):** an earlier version of this file had a real
token value printed in plain text here. If that value was ever actually used
in production, treat it as compromised and regenerate it from Settings →
Integrations → Backup → "Regenerate token" (this immediately invalidates the
old one), then update the `BACKUP_TOKEN` GitHub secret below to match.

### 2. Google Drive (primary destination) — **done, configured 2026-09-22**

Uses OAuth as the owner's own Google account — **not** a service account
(service accounts have zero Drive storage quota and cannot create files
even in a folder shared to them as Editor; confirmed by a failed run this
session before switching to OAuth). Steps taken (for reference / re-setup):

1. <https://console.cloud.google.com> → project **"Sahara OS backup"**
   (`sahara-os-backup`) → **APIs & Services → Library** → enabled **Google
   Drive API**.
2. **Google Auth Platform → Audience** → User type **External**, publishing
   status **Testing** → added `contact@saharacleaningservices.com` as a
   **Test user** (avoids Google's app-verification review, which isn't
   needed for a single-account internal tool).
3. **Clients → Create client → Web application**. Redirect URI:
   `https://developers.google.com/oauthplayground`. Downloaded the Client ID
   and secret (only shown once at creation time).
4. Minted a refresh token: <https://developers.google.com/oauthplayground> →
   gear icon → tick *Use your own OAuth credentials* → paste the client
   ID/secret → scope `https://www.googleapis.com/auth/drive` → **Authorize
   APIs** → signed in as `contact@saharacleaningservices.com` → clicked
   **Allow** (shows an "unverified app" warning since the app isn't
   submitted for Google review — expected and safe for internal use; click
   Advanced → Go to (unsafe) to proceed) → **Exchange authorization code for
   tokens** → copied the **Refresh token**.
5. Folder **Sahara OS Backups** already existed in the owner's own My
   Drive: `https://drive.google.com/drive/folders/1Gw4_xzzxQHUVixWXhdBdi-jEeSzlVxPZ`.
   Because the OAuth token authenticates as the folder's own owner, no
   separate sharing step is needed (unlike the abandoned service-account
   approach).

**Verified working (run #44, 2026-09-22)**: uploaded a real
`sahara-os-*.tar.gz`, confirmed present in the Drive folder, owned by "me"
(the account's own 30GB quota, not a service account's zero quota).

### 3. S3-compatible storage (optional, secondary — not configured)

Not provisioned, deliberately (no new paid storage service). Kept inert in
the workflow in case a no-added-cost bucket becomes available later. To
enable: create a bucket with any S3-compatible provider, then add these as
GitHub repo secrets (step 4):

| Secret | Value |
|---|---|
| `S3_BUCKET` | the bucket name |
| `S3_ENDPOINT_URL` | leave unset for AWS; set for any other provider (e.g. Hostinger Object Storage, Backblaze, Wasabi, R2) |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | the bucket's access credentials |
| `S3_REGION` | the bucket's region, if the provider requires one |
| `BACKUP_ENCRYPTION_KEY` | (optional) a passphrase for the weekly encrypted copy — without it, the Sunday encrypted step is skipped |

### 4. GitHub repo secrets

Repo → **Settings → Secrets and variables → Actions**:

| Secret | Value | Status |
|---|---|---|
| `BACKUP_URL` | `https://<production-domain>/api/backup` | ✅ set |
| `BACKUP_TOKEN` | the token from step 1 | ✅ set |
| `GDRIVE_FOLDER_ID` | `1Gw4_xzzxQHUVixWXhdBdi-jEeSzlVxPZ` | ✅ set |
| `GDRIVE_CREDENTIALS` | `{"client_id":"...","client_secret":"...","refresh_token":"..."}` on one line, from step 2 | ✅ set (OAuth, verified working) |
| `S3_BUCKET`, `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | from step 3 | not set (optional) |
| `BACKUP_ENCRYPTION_KEY` | (optional) from step 3 | not set (weekly-encrypted step skips until this exists) |

Already confirmed working (run #44) — no further action needed unless
credentials are rotated.

## Retention

- **Google Drive (primary)**: keeps the newest 30 daily archives, plus one
  archive per distinct calendar month for 12 months beyond that
  (`KEEP_DAILY`/`KEEP_MONTHLY` env vars in the workflow). Verified this
  session: after the first real upload, the script correctly reported
  "1 daily + 0 monthly backup(s) retained (1 total), 0 removed."
- **S3 (optional, if enabled later)**: same retention scheme.
- **Weekly encrypted copies**: kept separately, newest 12, same Drive folder
  (`.enc` suffix).
- **`BackupEvent` rows** (shown in Settings → System Recovery Backup) and
  **pre-restore safety copies** (`dev.db.before-restore-*`, written by
  `POST /api/backup/restore` before every restore) are each pruned to the
  most recent 500 and 5 respectively by the app itself — see
  `src/app/api/backup/route.ts` and `src/app/api/backup/restore/route.ts`.
- GitHub disables scheduled workflows after 60 days with no repo activity;
  a push or a manual run re-arms it.

## Restoring

See `BACKUP_RESTORE_GUIDE.md` for the full disaster-recovery walkthrough
(application crash, database corruption, VPS failure, server replacement)
and how to safely test a restore before trusting it.
