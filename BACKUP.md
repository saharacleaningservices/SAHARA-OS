# Automated off-site backups

> **Destination change (owner, 2026-11-14):** backups go to the Google Drive
> folder **`Sahara OS Backups` owned by `shaikhaltaf161@gmail.com`**. The
> folder name and owner are configurable (`GDRIVE_BACKUP_FOLDER_NAME`,
> `GDRIVE_BACKUP_OWNER_EMAIL`) and the upload script refuses / warns about a
> folder that does not match. Setup steps: **§2 below**. Until those steps are
> done, the existing `GDRIVE_FOLDER_ID` secret (the older folder under
> `contact@saharacleaningservices.com`) keeps receiving backups, with a
> warning in the run log — no night is lost.
>
> The nightly **scheduled** run uses the workflow on the default branch
> (`main`); these workflow/script changes take effect for the schedule only
> once they are merged to `main` (a manual "Run workflow" on this branch
> uses this branch's copy).

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

### 2. Google Drive (primary destination) — `Sahara OS Backups`, owned by `shaikhaltaf161@gmail.com`

**How the destination is chosen** (`.github/scripts/gdrive_backup.py`):

| Setting | Where | Default | Meaning |
|---|---|---|---|
| `GDRIVE_BACKUP_FOLDER_NAME` | repo **Variable** (or secret) | `Sahara OS Backups` | exact folder name |
| `GDRIVE_BACKUP_OWNER_EMAIL` | repo **Variable** (or secret) | `shaikhaltaf161@gmail.com` | the Google account that must own the folder (`-` = no owner check, e.g. a Shared Drive) |
| `GDRIVE_FOLDER_ID` | repo **secret**, optional | — | pins one folder id; it is still checked against the name + owner. If unset, the folder is found by name + owner |
| `GDRIVE_STRICT_FOLDER` | repo Variable, optional | `0` | `1` = fail the run when the pinned folder is not the owner's folder; `0` = warn and still upload |
| `GDRIVE_CREDENTIALS` | repo **secret** | — | who uploads (below) |

Never commit any of the credential values; they live only in GitHub → repo →
Settings → Secrets and variables → Actions.

**Important — who can upload into a `@gmail.com` folder.** Google service
accounts have **no My Drive storage quota**. A personal `@gmail.com` account
cannot have a Shared Drive, so a service account that the folder is merely
shared with can *see* the folder but every upload fails with
`storageQuotaExceeded` (this is exactly what run #43 hit in 2026-09). For a
folder owned by `shaikhaltaf161@gmail.com` the working option is therefore
**A** below. Option **B** is only for a Shared Drive (Google Workspace).

#### A. Recommended — OAuth as `shaikhaltaf161@gmail.com` (files use that account's quota)

1. Sign in to Google Drive as **shaikhaltaf161@gmail.com** → **New → New
   folder** → name it exactly **`Sahara OS Backups`** (in *My Drive*). If a
   folder with that name already exists there, use it; keep only one.
2. Open the folder; the id is the last part of the URL
   (`https://drive.google.com/drive/folders/<FOLDER_ID>`). Optional: share it
   (Viewer or Editor) with `contact@saharacleaningservices.com` if the office
   should see the backups too — ownership stays with shaikhaltaf161@gmail.com.
3. <https://console.cloud.google.com> → project **"Sahara OS backup"**
   (`sahara-os-backup`, or any project) → **APIs & Services → Library** →
   **Google Drive API** enabled.
4. **Google Auth Platform → Audience** → User type **External**, publishing
   status **Testing** → **Add users** → `shaikhaltaf161@gmail.com`.
   (Testing-mode refresh tokens expire after 7 days for some scopes; if runs
   start failing with `invalid_grant`, set the publishing status to
   **In production** — no review is needed for a single internal user who
   accepts the "unverified app" screen — and mint a new token.)
5. **Clients → Create client → Web application**, redirect URI
   `https://developers.google.com/oauthplayground`. Copy the Client ID and
   Client secret (an existing client from the 2026-09 setup can be reused).
6. <https://developers.google.com/oauthplayground> → gear icon → tick *Use
   your own OAuth credentials* → paste the client ID/secret → scope
   `https://www.googleapis.com/auth/drive` → **Authorize APIs** → sign in as
   **shaikhaltaf161@gmail.com** (not contact@) → Advanced → continue →
   **Allow** → **Exchange authorization code for tokens** → copy the
   **Refresh token**.
7. GitHub → repo → **Settings → Secrets and variables → Actions**:
   - **Secrets**: update `GDRIVE_CREDENTIALS` to
     `{"client_id":"…","client_secret":"…","refresh_token":"…"}` (one line,
     the refresh token from step 6). Then either **delete** `GDRIVE_FOLDER_ID`
     (the script finds the folder by name + owner) or **set** it to the id
     from step 2.
   - **Variables** (optional — the defaults already match):
     `GDRIVE_BACKUP_FOLDER_NAME` = `Sahara OS Backups`,
     `GDRIVE_BACKUP_OWNER_EMAIL` = `shaikhaltaf161@gmail.com`, and once the
     first run is green, `GDRIVE_STRICT_FOLDER` = `1` so a wrong folder fails
     loudly instead of warning.
8. **Actions → Sahara OS Enterprise Backup → Run workflow** (on `main`). The
   upload step must log
   `Destination: Drive folder 'Sahara OS Backups' owned by shaikhaltaf161@gmail.com (id=…)`
   and `Uploaded sahara-os-….tar.gz`. Check the file is in the folder in
   shaikhaltaf161@gmail.com's Drive. A `::warning::GDRIVE_FOLDER_ID … is owned
   by contact@…` line means step 7's `GDRIVE_FOLDER_ID` still points at the
   old folder.

#### B. Service account (only if the folder lives in a Shared Drive)

1. In Google Cloud create a service account (e.g.
   `sahara-os-backup-uploader@<project>.iam.gserviceaccount.com`) → **Keys →
   Add key → JSON**.
2. Put `Sahara OS Backups` in a **Shared Drive** where
   shaikhaltaf161@gmail.com is a Manager, and add the service-account email
   as **Content manager**. (Sharing a My Drive folder with it as Editor is
   *not* enough — no quota.)
3. Secrets: `GDRIVE_CREDENTIALS` = the whole JSON key on one line;
   `GDRIVE_FOLDER_ID` = the folder id. Variable `GDRIVE_BACKUP_OWNER_EMAIL` =
   `-` (Shared-Drive folders have no individual owner; the name is still
   checked).

#### History (2026-09-22 → 2026-11-14)

Backups were uploaded via OAuth as `contact@saharacleaningservices.com` into
its own "Sahara OS Backups" folder (pinned by `GDRIVE_FOLDER_ID`). Verified
working (run #44, 2026-09-22). Archives already in that folder are not moved
by this change; copy them to the new folder by hand if you want one place.

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
| `GDRIVE_FOLDER_ID` | optional — id of `Sahara OS Backups` in shaikhaltaf161@gmail.com's Drive, or delete it to look the folder up by name + owner | ⚠ currently the old contact@ folder — update per §2 A step 7 |
| `GDRIVE_CREDENTIALS` | `{"client_id":"...","client_secret":"...","refresh_token":"..."}` on one line, minted as shaikhaltaf161@gmail.com (§2 A step 6) | ⚠ currently minted as contact@ — re-mint per §2 A |
| Variables `GDRIVE_BACKUP_FOLDER_NAME` / `GDRIVE_BACKUP_OWNER_EMAIL` / `GDRIVE_STRICT_FOLDER` | see §2 | optional (defaults: `Sahara OS Backups` / `shaikhaltaf161@gmail.com` / `0`) |
| `S3_BUCKET`, `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | from step 3 | not set (optional) |
| `BACKUP_ENCRYPTION_KEY` | (optional) from step 3 | not set (weekly-encrypted step skips until this exists) |

The contact@ setup was confirmed working (run #44). Moving to
shaikhaltaf161@gmail.com's folder needs §2 A steps 1–8 (done by the owner —
the refresh token must be minted while signed in as that account).

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
